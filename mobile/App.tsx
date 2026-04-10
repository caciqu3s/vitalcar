import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import HomeScreen    from './src/screens/HomeScreen';
import SensorsScreen from './src/screens/SensorsScreen';
import AlertsScreen  from './src/screens/AlertsScreen';
import DTCScreen     from './src/screens/DTCScreen';
import ExplainScreen from './src/screens/ExplainScreen';

const Tab = createBottomTabNavigator();

// Minimal emoji icons — avoids needing @expo/vector-icons setup
const ICONS: Record<string, string> = {
  Home:    '🏠',
  Sensors: '📊',
  Alerts:  '🔔',
  DTC:     '🔍',
  Explain: '🧠',
};

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICONS[route.name]}</Text>,
          tabBarActiveTintColor:   '#3b82f6',
          tabBarInactiveTintColor: '#94a3b8',
          headerStyle:    { backgroundColor: '#1e40af' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '700' },
        })}
      >
        <Tab.Screen name="Home"    component={HomeScreen}    options={{ title: 'VitalCar' }} />
        <Tab.Screen name="Sensors" component={SensorsScreen} options={{ title: 'Sensors'  }} />
        <Tab.Screen name="Alerts"  component={AlertsScreen}  options={{ title: 'Alerts'   }} />
        <Tab.Screen name="DTC"     component={DTCScreen}     options={{ title: 'Fault Codes' }} />
        <Tab.Screen name="Explain" component={ExplainScreen} options={{ title: 'Why?' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
