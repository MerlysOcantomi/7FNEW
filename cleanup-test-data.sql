-- SCRIPT PARA ELIMINAR DATOS DE PRUEBA DEL INBOX
-- Ejecutar en tu base de datos para limpiar mensajes hardcodeados

-- 1. Eliminar mensajes de conversaciones de debug
DELETE FROM "Message" 
WHERE "conversationId" IN (
  SELECT id FROM "Conversation" 
  WHERE source = 'debug'
);

-- 2. Eliminar conversaciones de debug  
DELETE FROM "Conversation"
WHERE source = 'debug';

-- 3. Eliminar contactos de debug
DELETE FROM "Contact" 
WHERE email LIKE '%@debug.local' 
   OR nombre = 'Test Visitor'
   OR source LIKE 'debug_%';

-- Verificar limpieza
SELECT COUNT(*) as "Conversations restantes con source=debug" 
FROM "Conversation" WHERE source = 'debug';

SELECT COUNT(*) as "Contactos restantes con email debug" 
FROM "Contact" WHERE email LIKE '%@debug.local';