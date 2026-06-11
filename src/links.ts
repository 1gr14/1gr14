import launch from 'open'

/**
 * Canonical 1gr14 links. The site is home, `support` is the subscription page; the rest are community channels. The CLI
 * opens these; you can also read them from code.
 */
export const links = {
  site: 'https://1gr14.dev',
  support: 'https://1gr14.dev/support',
  youtube: 'https://www.youtube.com/@s_1gr14',
  discord: 'https://discord.gg/hWgtn58FVv',
  tg: 'https://t.me/s_1gr14',
  x: 'https://x.com/s_1gr14',
} as const

/** A 1gr14 link name — a key of {@link links}. */
export type LinkName = keyof typeof links

/**
 * Open a 1gr14 link in the default browser.
 *
 * @example
 *   await openLink('discord') // opens the Discord server
 *
 * @returns The URL that was opened.
 */
export const openLink = async (name: LinkName): Promise<string> => {
  const url = links[name]
  await launch(url)
  return url
}
