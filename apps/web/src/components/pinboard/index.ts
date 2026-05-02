export { Paper } from './paper'
export { Tape } from './tape'

export const rot = (i: number) => ((i * 37) % 7 - 3) * 0.5
export const lift = (i: number) => ((i * 53) % 5 - 2) * 2
