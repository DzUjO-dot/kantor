import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const hostFromExpo = Constants.expoConfig?.hostUri?.split(':')?.[0];
const defaultHost = Platform.select({ android: '10.0.2.2', default: 'localhost' });
const API_BASE_URL = `http://${hostFromExpo || defaultHost}:3000/api`;

const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    const text = title && message ? `${title}: ${message}` : title || message || '';
    alert(text);
    return;
  }
  Alert.alert(title || '', message || '');
};

function DismissKeyboardView({ children }) {
  if (Platform.OS === 'web') {
    return (
      <View style={{ flex: 1 }} pointerEvents="box-none">
        {children}
      </View>
    );
  }
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>{children}</View>
    </TouchableWithoutFeedback>
  );
}

async function apiRequest(path, method = 'GET', body, token) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = 'Blad zadania';
    try {
      const json = JSON.parse(text);
      msg = json.message || msg;
    } catch (_) {}
    throw new Error(msg);
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function AuthScreen({ onLoggedIn }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!email || !password) {
        setError('Podaj email i haslo');
        setLoading(false);
        return;
      }

      if (isLogin) {
        const data = await apiRequest('/auth/login', 'POST', { email, password }, null);
        await AsyncStorage.setItem('jwt_token', data.token);
        onLoggedIn(data.token);
      } else {
        await apiRequest('/auth/register', 'POST', { email, password }, null);
        const data = await apiRequest('/auth/login', 'POST', { email, password }, null);
        await AsyncStorage.setItem('jwt_token', data.token);
        onLoggedIn(data.token);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DismissKeyboardView>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>{isLogin ? 'Logowanie' : 'Rejestracja'}</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Haslo"
          secureTextEntry
          style={styles.input}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Button title={isLogin ? 'Zaloguj' : 'Zarejestruj i zaloguj'} onPress={handleSubmit} />
        )}
        <View style={{ height: 12 }} />
        <Button
          title={isLogin ? 'Nie masz konta? Zaloz nowe' : 'Masz konto? Zaloguj sie'}
          onPress={() => {
            setIsLogin(!isLogin);
            setError(null);
          }}
        />
      </SafeAreaView>
    </DismissKeyboardView>
  );
}

function WalletScreen({ token }) {
  const [balances, setBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topUpAmount, setTopUpAmount] = useState('');

  const loadWallet = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/wallet', 'GET', null, token);
      setBalances(data?.balances || []);
    } catch (e) {
      showAlert('Blad', e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  useFocusEffect(
    useCallback(() => {
      loadWallet();
    }, [loadWallet])
  );

  const handleTopUp = async () => {
    const value = topUpAmount.replace(',', '.');
    const amount = parseFloat(value);
    if (!amount || amount <= 0) {
      showAlert('Blad', 'Podaj poprawna kwote');
      return;
    }
    try {
      await apiRequest('/wallet/topup', 'POST', { amountPln: amount }, token);
      setTopUpAmount('');
      await loadWallet();
    } catch (e) {
      showAlert('Blad', e.message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const pln = balances.find((b) => b.currency_code === 'PLN');
  const plnValue = pln ? pln.balance.toFixed(2) : '0.00';
  const otherBalances = balances.filter(
    (b) => b.currency_code !== 'PLN' && Math.abs(b.balance) > 1e-8
  );

  return (
    <DismissKeyboardView>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Portfel</Text>
        <Text style={styles.bigText}>Saldo PLN: {plnValue}</Text>

        <View style={{ height: 16 }} />

        <Text style={styles.label}>Zasil konto (PLN)</Text>
        <TextInput
          value={topUpAmount}
          onChangeText={setTopUpAmount}
          keyboardType="numeric"
          style={styles.input}
        />
        <Button title="Zasil" onPress={handleTopUp} />

        <View style={{ height: 24 }} />
        <Text style={styles.label}>Pozostale waluty:</Text>
        <FlatList
          data={otherBalances}
          keyExtractor={(item) => item.currency_code}
          renderItem={({ item }) => (
            <View style={styles.listItem}>
              <Text style={styles.listItemText}>{item.currency_code}</Text>
              <Text>{item.balance.toFixed(4)}</Text>
            </View>
          )}
        />
      </SafeAreaView>
    </DismissKeyboardView>
  );
}

function ExchangeScreen({ token }) {
  const [isBuy, setIsBuy] = useState(true);
  const [currency, setCurrency] = useState('EUR');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [plnBalance, setPlnBalance] = useState(null);

  const currencies = ['EUR', 'USD', 'GBP', 'CHF'];

  const loadBalance = useCallback(async () => {
    try {
      setBalanceLoading(true);
      const data = await apiRequest('/wallet', 'GET', null, token);
      const pln = data?.balances?.find((b) => b.currency_code === 'PLN');
      setPlnBalance(pln ? pln.balance : 0);
    } catch (e) {
      showAlert('Blad', e.message);
    } finally {
      setBalanceLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadBalance();
  }, [loadBalance]);

  useFocusEffect(
    useCallback(() => {
      loadBalance();
    }, [loadBalance])
  );

  const handleExchange = async () => {
    const value = amount.replace(',', '.');
    const num = parseFloat(value);
    if (!num || num <= 0) {
      showAlert('Blad', 'Podaj poprawna kwote');
      return;
    }
    try {
      setLoading(true);
      await apiRequest(
        '/transactions/exchange',
        'POST',
        {
          type: isBuy ? 'BUY' : 'SELL',
          currency,
          amount: num,
        },
        token
      );
      showAlert('OK', 'Transakcja wykonana');
      setAmount('');
      await loadBalance();
    } catch (e) {
      showAlert('Blad', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DismissKeyboardView>
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Wymiana walut</Text>
        <Text style={styles.bigText}>
          Saldo PLN:{' '}
          {balanceLoading ? '...' : (plnBalance ?? 0).toFixed(2)}
        </Text>
        <View style={{ height: 8 }} />

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, isBuy && styles.toggleButtonActive]}
            onPress={() => setIsBuy(true)}
          >
            <Text style={isBuy ? styles.toggleTextActive : styles.toggleText}>Kup walute</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, !isBuy && styles.toggleButtonActive]}
            onPress={() => setIsBuy(false)}
          >
            <Text style={!isBuy ? styles.toggleTextActive : styles.toggleText}>Sprzedaj walute</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Waluta</Text>
        <View style={styles.chipRow}>
          {currencies.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.chip, currency === c && styles.chipActive]}
              onPress={() => setCurrency(c)}
            >
              <Text style={currency === c ? styles.chipTextActive : styles.chipText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Kwota w {currency}</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          style={styles.input}
        />

        {loading ? (
          <ActivityIndicator />
        ) : (
          <Button title="Wykonaj transakcje" onPress={handleExchange} />
        )}
      </SafeAreaView>
    </DismissKeyboardView>
  );
}

function RatesScreen({ token }) {
  const [loading, setLoading] = useState(true);
  const [effectiveDate, setEffectiveDate] = useState(null);
  const [rates, setRates] = useState([]);

  const loadRates = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/rates/current', 'GET', null, token);
      setEffectiveDate(data?.effectiveDate || null);
      setRates(data?.rates || []);
    } catch (e) {
      showAlert('Blad', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRates();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Aktualne kursy (tabela C)</Text>
      {effectiveDate && <Text style={styles.label}>Data tabeli: {effectiveDate}</Text>}
      <FlatList
        data={rates}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <View>
              <Text style={styles.listItemText}>
                {item.code} - {item.currency}
              </Text>
              <Text>kupno: {item.bid.toFixed(4)}</Text>
            </View>
            <Text>sprzedaz: {item.ask.toFixed(4)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function TransactionsScreen({ token }) {
  const [loading, setLoading] = useState(true);
  const [txs, setTxs] = useState([]);

  const loadTxs = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/transactions', 'GET', null, token);
      setTxs(data?.transactions || []);
    } catch (e) {
      showAlert('Blad', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTxs();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!txs.length) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Brak transakcji</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Historia transakcji</Text>
      <FlatList
        data={txs}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.listItem}>
            <View>
              <Text style={styles.listItemText}>
                {item.type} {item.currency_code} {item.amount.toFixed(4)}
              </Text>
              <Text>PLN: {item.base_amount_pln.toFixed(2)}</Text>
            </View>
            <Text style={{ fontSize: 12 }}>
              {item.created_at?.replace('T', ' ').slice(0, 16)}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const Tab = createBottomTabNavigator();

function MainTabs({ token, onLogout }) {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Portfel">{() => <WalletScreen token={token} />}</Tab.Screen>
      <Tab.Screen name="Wymiana">{() => <ExchangeScreen token={token} />}</Tab.Screen>
      <Tab.Screen name="Kursy">{() => <RatesScreen token={token} />}</Tab.Screen>
      <Tab.Screen name="Historia">{() => <TransactionsScreen token={token} />}</Tab.Screen>
      <Tab.Screen name="Konto">
        {() => (
          <SafeAreaView style={styles.center}>
            <Text>Jestes zalogowany</Text>
            <View style={{ height: 12 }} />
            <Button title="Wyloguj" onPress={onLogout} />
          </SafeAreaView>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [token, setToken] = useState(null);
  const [checkingToken, setCheckingToken] = useState(true);

  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem('jwt_token');
      if (saved) setToken(saved);
      setCheckingToken(false);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('jwt_token');
    setToken(null);
  };

  if (checkingToken) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <NavigationContainer>
      {token ? <MainTabs token={token} onLogout={handleLogout} /> : <AuthScreen onLoggedIn={setToken} />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  bigText: {
    fontSize: 20,
    fontWeight: '600',
  },
  label: {
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  error: {
    color: 'red',
    marginBottom: 8,
  },
  listItem: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listItemText: {
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  toggleTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#007AFF',
  },
  chipText: {
    color: '#007AFF',
  },
  chipTextActive: {
    color: 'white',
  },
});
