import storage from '@/core/storage'

export default {
  async toggleSide(handler) {
    await toggle(handler, 'hiddenSide', false)
  },
  async toggleCentered(handler) {
    await toggle(handler, 'centered', true)
  },
  async toggleRefresh(handler) {
    await toggle(handler, 'refresh', false)
  },
  async toggleTheme(handler) {
    const { pageTheme = 'auto' } = await storage.get('pageTheme')
    const next =
      pageTheme === 'auto' ? 'light' : pageTheme === 'light' ? 'dark' : 'auto'
    handler('storage', { key: 'pageTheme', value: next })
  },
}

async function toggle(handler, key, defaultValue) {
  const data = await storage.get(key)
  const value = data[key] === undefined ? defaultValue : data[key]
  handler('storage', { key, value: !value })
}
