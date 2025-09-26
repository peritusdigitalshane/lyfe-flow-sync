// Shared utility functions for Supabase Edge Functions

/**
 * Type guard to check if an error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Safely get error message from unknown error
 */
export function getErrorMessage(error: unknown, fallback = 'Unknown error'): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return fallback;
}

/**
 * CORS headers for edge functions
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Create error response with proper typing
 */
export function createErrorResponse(
  error: unknown,
  message: string,
  status = 500
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      details: getErrorMessage(error)
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Create success response with proper typing
 */
export function createSuccessResponse(data: any, status = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      ...data
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}