// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

const { TextDecoder, TextEncoder } = require('util')
const { ReadableStream, WritableStream, TransformStream } = require('stream/web')
const { MessageChannel, MessagePort } = require('worker_threads')

global.TextEncoder = global.TextEncoder || TextEncoder
global.TextDecoder = global.TextDecoder || TextDecoder
global.ReadableStream = global.ReadableStream || ReadableStream
global.WritableStream = global.WritableStream || WritableStream
global.TransformStream = global.TransformStream || TransformStream
global.MessageChannel = global.MessageChannel || MessageChannel
global.MessagePort = global.MessagePort || MessagePort
const fetchApi = require('undici')
global.fetch = global.fetch || fetchApi.fetch
global.Request = fetchApi.Request
global.Response = fetchApi.Response
global.Headers = fetchApi.Headers
global.FormData = fetchApi.FormData
global.Response.json = global.Response.json || ((body, init) => new global.Response(JSON.stringify(body), {
  ...init,
  headers: {
    'content-type': 'application/json',
    ...(init && init.headers ? init.headers : {}),
  },
}))

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
process.env.SESSION_SECRET = 'test-secret'
process.env.WHATSAPP_WEBHOOK_SECRET = 'test-secret'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => store[key] = value.toString(),
    removeItem: (key) => delete store[key],
    clear: () => store = {},
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
})

// Mock crypto for Node environment
if (typeof global.crypto === 'undefined') {
  global.crypto = {
    getRandomValues: (arr) => {
      const bytes = new Uint8Array(arr.length)
      for (let i = 0; i < arr.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256)
      }
      return bytes
    },
  }
}

// Suppress console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
}

