import React, { useEffect, useRef } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'react-native';
import { initDB, getUserProfile } from '../db/database';

export default function RootLayout() {
  const hasNavigated = useRef(false);

  useEffect(() => {
    async function setupApp() {
      try {
        await initDB();
        const profile = await getUserProfile();
        
        hasNavigated.current = true;
        
        if (!profile) {
          router.replace('/onboarding/welcome');
        } else if (!profile.models_downloaded) {
          router.replace('/onboarding/model-download');
        } else {
          router.replace('/');
        }
      } catch (error) {
        console.error('App initialization error:', error);
        router.replace('/onboarding/welcome');
      }
    }

    setupApp();
  }, []);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#080808" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#080808' },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="record" />
        <Stack.Screen name="review" />
        <Stack.Screen name="list" />
        <Stack.Screen name="benchmarks" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="onboarding/welcome" />
        <Stack.Screen name="onboarding/model-download" />
      </Stack>
    </>
  );
}

