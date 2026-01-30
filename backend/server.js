require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');
const { promisify } = require('util');

const app = express();
const PORT = process.env.PORT || 8081;
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));
const dbRun = (...args) =>
  new Promise((resolve, reject) => {
    db.run(...args, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });

app.use(cors());
app.use(express.json());

async function getOrCreateBalance(userId, currencyCode) {
  let row = await dbGet(
    'SELECT * FROM wallet_balances WHERE user_id = ? AND currency_code = ?',
    [userId, currencyCode]
  );
  if (!row) {
    await dbRun(
      'INSERT INTO wallet_balances (user_id, currency_code, balance) VALUES (?, ?, ?)',
      [userId, currencyCode, 0]
    );
    row = await dbGet(
      'SELECT * FROM wallet_balances WHERE user_id = ? AND currency_code = ?',
      [userId, currencyCode]
    );
  }
  return row;
}

async function updateBalance(userId, currencyCode, newBalance) {
  await dbRun(
    'UPDATE wallet_balances SET balance = ? WHERE user_id = ? AND currency_code = ?',
    [newBalance, userId, currencyCode]
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.sendStatus(401);
  const token = authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email i hasło są wymagane' });

    const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ message: 'Użytkownik już istnieje' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const createdAt = new Date().toISOString();

    const result = await dbRun(
      'INSERT INTO users (email, password_hash, created_at, is_active) VALUES (?, ?, ?, 1)',
      [email, passwordHash, createdAt]
    );

    await dbRun(
      'INSERT OR IGNORE INTO wallet_balances (user_id, currency_code, balance) VALUES (?, ?, 0)',
      [result.lastID, 'PLN']
    );

    res.status(201).json({ message: 'Zarejestrowano pomyślnie' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) return res.status(401).json({ message: 'Nieprawidłowe dane logowania' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ message: 'Nieprawidłowe dane logowania' });

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Błąd serwera' });
  }
});

async function fetchCurrentRatesTableC() {
  const url = 'https://api.nbp.pl/api/exchangerates/tables/C/?format=json';
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('NBP error');
  const data = await resp.json();
  const table = data[0];
  return table;
}

async function fetchHistoryRates(code, start, end) {
  const url = `https://api.nbp.pl/api/exchangerates/rates/A/${code}/${start}/${end}/?format=json`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('NBP history error');
  const data = await resp.json();
  return data;
}

app.get('/api/rates/current', authenticateToken, async (req, res) => {
  try {
    const table = await fetchCurrentRatesTableC();
    res.json({
      effectiveDate: table.effectiveDate,
      rates: table.rates
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Błąd pobierania kursów z NBP' });
  }
});

app.get('/api/rates/history', authenticateToken, async (req, res) => {
  try {
    const { code, start, end } = req.query;
    if (!code || !start || !end) {
      return res.status(400).json({ message: 'Wymagane parametry: code, start, end' });
    }
    const data = await fetchHistoryRates(code, start, end);
    res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Błąd pobierania kursów archiwalnych' });
  }
});

app.get('/api/wallet', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    await getOrCreateBalance(userId, 'PLN');

    const balances = await dbAll(
      'SELECT currency_code, balance FROM wallet_balances WHERE user_id = ?',
      [userId]
    );
    res.json({ balances });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Błąd pobierania portfela' });
  }
});

app.post('/api/wallet/topup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { amountPln } = req.body;
    const amount = Number(amountPln);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Kwota musi być > 0' });
    }

    const pln = await getOrCreateBalance(userId, 'PLN');
    const newBalance = pln.balance + amount;
    await updateBalance(userId, 'PLN', newBalance);

    const now = new Date().toISOString();
    await dbRun(
      `INSERT INTO transactions
       (user_id, type, currency_code, amount, base_amount_pln, rate, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, 'TOP_UP', 'PLN', amount, amount, 1.0, now]
    );

    res.json({ message: 'Konto zasilone', newBalance });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Błąd zasilenia konta' });
  }
});

app.post('/api/transactions/exchange', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, currency, amount } = req.body;
    const upperType = String(type || '').toUpperCase();
    const code = String(currency || '').toUpperCase();
    const amt = Number(amount);

    if (!['BUY', 'SELL'].includes(upperType)) {
      return res.status(400).json({ message: 'type musi być BUY lub SELL' });
    }
    if (!code || !amt || amt <= 0) {
      return res.status(400).json({ message: 'Nieprawidłowe dane transakcji' });
    }

    const table = await fetchCurrentRatesTableC();
    const rateObj = table.rates.find(r => r.code === code);
    if (!rateObj) {
      return res.status(400).json({ message: 'Nieznany kod waluty' });
    }

    const rate = upperType === 'BUY' ? rateObj.ask : rateObj.bid;
    const rateNumber = Number(rate);
    const baseAmountPln = amt * rateNumber;

    const pln = await getOrCreateBalance(userId, 'PLN');
    const foreign = await getOrCreateBalance(userId, code);

    if (upperType === 'BUY') {
      if (pln.balance < baseAmountPln) {
        return res.status(400).json({ message: 'Za mało PLN na koncie' });
      }
      await updateBalance(userId, 'PLN', pln.balance - baseAmountPln);
      await updateBalance(userId, code, foreign.balance + amt);
    } else {
      if (foreign.balance < amt) {
        return res.status(400).json({ message: 'Za mało waluty na koncie' });
      }
      await updateBalance(userId, code, foreign.balance - amt);
      await updateBalance(userId, 'PLN', pln.balance + baseAmountPln);
    }

    const now = new Date().toISOString();
    const result = await dbRun(
      `INSERT INTO transactions
       (user_id, type, currency_code, amount, base_amount_pln, rate, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, upperType, code, amt, baseAmountPln, rateNumber, now]
    );

    res.json({
      message: 'Transakcja wykonana',
      transaction: {
        id: result.lastID,
        type: upperType,
        currencyCode: code,
        amount: amt,
        baseAmountPln,
        rate: rateNumber,
        createdAt: now
      }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Błąd realizacji transakcji' });
  }
});

app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await dbAll(
      `SELECT id, type, currency_code, amount, base_amount_pln, rate, created_at
       FROM transactions
       WHERE user_id = ?
       ORDER BY datetime(created_at) DESC`,
      [userId]
    );
    res.json({ transactions: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Błąd pobierania historii' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend startuje na http://localhost:${PORT}`);
});