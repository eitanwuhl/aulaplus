// Script simple para verificar la API key de OpenAI
// Ejecutar con: node check-apikey.js

// En Supabase Edge Functions, las variables de entorno se leen desde .env
// Pero localmente, podemos verificar si está en el sistema

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Verificando OpenAI API Key ===\n');

// 1. Verificar variable de entorno del sistema
const systemEnvKey = process.env.OPENAI_API_KEY;
if (systemEnvKey) {
  console.log('✅ Encontrada en variables de entorno del sistema:');
  console.log(`   ${systemEnvKey.substring(0, 10)}...${systemEnvKey.substring(systemEnvKey.length - 4)}`);
  console.log(`   Longitud: ${systemEnvKey.length} caracteres\n`);
} else {
  console.log('❌ No encontrada en variables de entorno del sistema\n');
}

// 2. Verificar archivo .env en la raíz del proyecto
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  console.log('📄 Archivo .env encontrado, buscando OPENAI_API_KEY...');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  const openaiLine = envLines.find(line => line.startsWith('OPENAI_API_KEY='));
  if (openaiLine) {
    const key = openaiLine.split('=')[1]?.trim();
    if (key) {
      console.log('✅ Encontrada en .env:');
      console.log(`   ${key.substring(0, 10)}...${key.substring(key.length - 4)}`);
      console.log(`   Longitud: ${key.length} caracteres\n`);
    }
  } else {
    console.log('❌ OPENAI_API_KEY no encontrada en .env\n');
  }
} else {
  console.log('❌ Archivo .env no encontrado\n');
}

// 3. Verificar archivo .env.local
const envLocalPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envLocalPath)) {
  console.log('📄 Archivo .env.local encontrado, buscando OPENAI_API_KEY...');
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  const envLines = envContent.split('\n');
  const openaiLine = envLines.find(line => line.startsWith('OPENAI_API_KEY='));
  if (openaiLine) {
    const key = openaiLine.split('=')[1]?.trim();
    if (key) {
      console.log('✅ Encontrada en .env.local:');
      console.log(`   ${key.substring(0, 10)}...${key.substring(key.length - 4)}`);
      console.log(`   Longitud: ${key.length} caracteres\n`);
    }
  } else {
    console.log('❌ OPENAI_API_KEY no encontrada en .env.local\n');
  }
} else {
  console.log('ℹ️  Archivo .env.local no encontrado\n');
}

// 4. Verificar configuración de Supabase
const supabaseConfigPath = path.join(__dirname, 'supabase', '.env');
if (fs.existsSync(supabaseConfigPath)) {
  console.log('📄 Archivo supabase/.env encontrado, buscando OPENAI_API_KEY...');
  const envContent = fs.readFileSync(supabaseConfigPath, 'utf8');
  const envLines = envContent.split('\n');
  const openaiLine = envLines.find(line => line.startsWith('OPENAI_API_KEY='));
  if (openaiLine) {
    const key = openaiLine.split('=')[1]?.trim();
    if (key) {
      console.log('✅ Encontrada en supabase/.env:');
      console.log(`   ${key.substring(0, 10)}...${key.substring(key.length - 4)}`);
      console.log(`   Longitud: ${key.length} caracteres\n`);
    }
  } else {
    console.log('❌ OPENAI_API_KEY no encontrada en supabase/.env\n');
  }
} else {
  console.log('ℹ️  Archivo supabase/.env no encontrado\n');
}

console.log('=== Fin de verificación ===');
console.log('\n💡 Nota: En Supabase Edge Functions, la API key se configura en:');
console.log('   Supabase Dashboard → Settings → Edge Functions → Secrets');
console.log('   O localmente con: supabase secrets set OPENAI_API_KEY=tu_key');
