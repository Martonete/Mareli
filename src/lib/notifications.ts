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
      console.log('Error obteniendo push token', e);
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
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data = {}) {
  // Verificamos si es un token de expo válido simple
  if (!expoPushToken || !expoPushToken.includes('ExponentPushToken')) return;

  const message = {
    to: expoPushToken,
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
    console.error('Error enviando notificación push:', error);
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
