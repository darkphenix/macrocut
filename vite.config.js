import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import JavaScriptObfuscator from 'javascript-obfuscator'

const OBFUSCATION_OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.2,
  deadCodeInjection: false,
  debugProtection: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: true,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
}

function obfuscateBundlePlugin(enabled) {
  return {
    name: 'obfuscate-bundle',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      if (!enabled) return
      for (const file of Object.values(bundle)) {
        if (file.type !== 'chunk') continue
        file.code = JavaScriptObfuscator
          .obfuscate(file.code, OBFUSCATION_OPTIONS)
          .getObfuscatedCode()
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const isProdObfuscated = mode === 'prod'

  return {
    plugins: [react(), obfuscateBundlePlugin(isProdObfuscated)],
    base: './',
    build: {
      outDir: isProdObfuscated ? 'production' : 'dist',
    },
    server: {
      port: 5173,
      host: true,
    },
  }
})
