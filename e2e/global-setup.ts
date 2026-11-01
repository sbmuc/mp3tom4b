import { makeFixtures } from './fixtures'

export default async function globalSetup() {
  await makeFixtures()
}
