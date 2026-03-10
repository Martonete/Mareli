import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? 'BDEF1RWXIIYS9aBKRbOzyn3yhkbYecCjP4Jg3yZRhr_iw6s6QvEmoGsLa7k6pW8i7wOzWvrmQCk3brKnPj2cpbg';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? 'oO-osJYqycd1rE9UGhIW-Fe4ULiiElfB2aAcxRvHyAM';

// Las llaves deben incluir correo para que Apple/Google puedan contactar por abusos de spam
webpush.setVapidDetails(
  'mailto:soporte@casaenorden.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

serve(async (req) => {
  // Configuración de Seguridad y CORS indispensable para Vercel
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  });

  // Pre-flight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const { subscription, title, body, data } = await req.json();

    if (!subscription) {
      return new Response(JSON.stringify({ error: 'Falta subscripción de la web.' }), { 
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' } 
      });
    }

    const payload = JSON.stringify({
      title: title || 'Alerta de Casa en Orden',
      body: body || 'Alguien actualizó una tarea.',
      data: data || {}
    });

    const result = await webpush.sendNotification(subscription, payload);
    
    return new Response(JSON.stringify({ success: true, result }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error enviando notificacion Web Push criptográfica:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
