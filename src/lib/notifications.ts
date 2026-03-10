import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

let Notifications: any = null;

try {
  // En Expo SDK 53+, Expo Go elimina el soporte y crashea el motor JS si se importa esta librería.
  // La requerimos de forma dinámica y la atrapamos si el entorno es inseguro.
  Notifications = require('expo-notifications');
  
  // Configura cómo el dispositivo debe manejar las notificaciones cuando la app está abierta
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch (e) {
  console.log('Notificaciones Push deshabilitadas de fábrica (Requiere Build de Desarrollo).');
}

/**
 * Solicita permisos y obtiene el Push Token del dispositivo para Expo.
 */
export async function registerForPushNotificationsAsync() {
  if (!Notifications) {
    console.log('Omitiendo registro de notificaciones porque el módulo no está disponible.');
    return undefined;
  }

  let token;

  if (Platform.OS === 'web') {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('El navegador no soporta Push Notifications nativas.');
        return undefined;
      }
      
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        // Llave pública generada para CasaEnOrden
        const VAPID_PUBLIC_KEY = 'BDEF1RWXIIYS9aBKRbOzyn3yhkbYecCjP4Jg3yZRhr_iw6s6QvEmoGsLa7k6pW8i7wOzWvrmQCk3brKnPj2cpbg';
        
        // Conversión a Binario Uint8Array
        const padding = '='.repeat((4 - VAPID_PUBLIC_KEY.length % 4) % 4);
        const base64 = (VAPID_PUBLIC_KEY + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const applicationServerKey = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) applicationServerKey[i] = rawData.charCodeAt(i);

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }
      
      // Convertimos la subscripción de la web en string para guardarla en supabase
      return JSON.stringify(subscription);
    } catch (e) {
      console.error('Error registrando Web Push:', e);
      return undefined;
    }
  }

  // --- Lógica NATIVA (Expo / Android) ---
  if (Platform.OS === 'android') {
    Notifications?.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications?.AndroidImportance?.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#8B4513',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications?.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications?.requestPermissionsAsync();
      finalStatus = status;
    }
    
    // Si el usuario deniega, salimos silenciosamente
    if (finalStatus !== 'granted') {
      return undefined;
    }

    try {
      const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      
      const tokenResponse = await Notifications?.getExpoPushTokenAsync({
        projectId: projectId ?? "fake-project-id", // Por seguridad en caso de fallo
      });
      token = tokenResponse?.data;
    } catch (e) {
      console.log('Error obteniendo push token nativo', e);
    }
  } else {
    // Es un emulador
    console.log('Se requiere dispositivo físico para Notificaciones Push (Expo)');
  }

  return token;
}

/**
 * Envía una Notificación Push usando el servico de EXPO.
 * @param expoPushToken El token destino (del otro usuario)
 * @param title Título de la notificación
 * @param body Cuerpo o texto del mensaje
 */
export async function sendPushNotification(pushToken: string, title: string, body: string, data = {}) {
  if (!pushToken) return;

  // 1. Si el token tiene formato de Expo, usamos el servidor de Expo (Para Android)
  if (pushToken.includes('ExponentPushToken')) {
    const message = {
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
    };

    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('Error enviando notificación push Expo:', error);
    }
    return;
  }

  // 2. Si el token es un objeto JSON (Web Push Subscription Safari/Chrome), llamamos a nuestro propio backend (Edge Function)
  if (pushToken.startsWith('{')) {
    try {
      const subscription = JSON.parse(pushToken);
      
      const { error } = await supabase.functions.invoke('send-web-push', {
        body: { subscription, title, body, data }
      });

      if (error) console.error('Supabase Edge Function Error:', error);
    } catch (error) {
      console.error('Error enviando notificación Web Push:', error);
    }
  }
}

/**
 * Función útil para notificar automáticamente a la pareja sin tener que buscar su token a mano.
 */
export async function notifyOtherUser(activeProfileName: string, title: string, body: string, data = {}) {
  const otherName = activeProfileName === 'Liz' ? 'Martin' : 'Liz';
  
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('name', otherName)
      .single();
      
    if (profile?.push_token) {
      await sendPushNotification(profile.push_token, title, body, data);
    }
  } catch (error) {
    console.error('Error fetching inter-profile push token:', error);
  }
}
