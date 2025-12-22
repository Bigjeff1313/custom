import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/mysql@v2.12.1/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create MySQL connection
async function getConnection() {
  const client = await new Client().connect({
    hostname: Deno.env.get('MYSQL_HOST') || '',
    username: Deno.env.get('MYSQL_USER') || '',
    password: Deno.env.get('MYSQL_PASSWORD') || '',
    db: Deno.env.get('MYSQL_DATABASE') || '',
    port: parseInt(Deno.env.get('MYSQL_PORT') || '3306'),
  });
  return client;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let client: Client | null = null;

  try {
    const { action, table, data, where, id } = await req.json();
    
    console.log(`MySQL API called: action=${action}, table=${table}`);
    
    client = await getConnection();
    let result;

    switch (action) {
      case 'select':
        // SELECT query
        if (where) {
          const whereClause = Object.keys(where).map(key => `${key} = ?`).join(' AND ');
          const whereValues = Object.values(where);
          result = await client.query(`SELECT * FROM ${table} WHERE ${whereClause}`, whereValues);
        } else {
          result = await client.query(`SELECT * FROM ${table}`);
        }
        break;

      case 'insert':
        // INSERT query
        const insertColumns = Object.keys(data).join(', ');
        const insertPlaceholders = Object.keys(data).map(() => '?').join(', ');
        const insertValues = Object.values(data);
        result = await client.execute(
          `INSERT INTO ${table} (${insertColumns}) VALUES (${insertPlaceholders})`,
          insertValues
        );
        break;

      case 'update':
        // UPDATE query
        const updateSet = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const updateValues = [...Object.values(data), id];
        result = await client.execute(
          `UPDATE ${table} SET ${updateSet} WHERE id = ?`,
          updateValues
        );
        break;

      case 'delete':
        // DELETE query
        result = await client.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
        break;

      case 'query':
        // Custom query (for advanced use)
        result = await client.query(data.sql, data.params || []);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    await client.close();
    
    console.log(`MySQL API success: ${JSON.stringify(result).substring(0, 200)}`);

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('MySQL API error:', errorMessage);
    
    if (client) {
      try {
        await client.close();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
