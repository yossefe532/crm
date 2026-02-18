import { expect, afterEach } from "vitest"
import * as matchers from "@testing-library/jest-dom/matchers"
import { cleanup } from "@testing-library/react"

expect.extend(matchers)
afterEach(() => {
  cleanup()
})

// jsdom polyfills
if (typeof window !== "undefined" && !("matchMedia" in window)) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  })
}
if (!(globalThis as any).matchMedia) {
  ;(globalThis as any).matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })
}
