import { mount } from '@vue/test-utils'
import HomePage from '@/views/HomePage.vue'
import { describe, expect, test } from 'vitest'

describe('HomePage.vue', () => {
  test('renders home vue', () => {
    const wrapper = mount(HomePage)
    // Was still asserting "Battery" from the Ionic starter template this project
    // was generated from, which no longer appears anywhere in the app.
    expect(wrapper.text()).toMatch('Erinnerungen')
  })
})
