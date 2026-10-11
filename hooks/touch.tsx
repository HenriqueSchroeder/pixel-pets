import type { ClientModule, ClientPointerType } from 'claude-code'

import type { Run } from './render'

export type Art = { columns: number; rows: number; fps: number; art: Run[][] }
type State = { queue: ClientPointerType[] }

// The main pet, drawn here as text so the pointer over it reaches the hooks: a
// Raster takes no pointer, and one drawn over a Raster stills it. Each tick it
// hands over what the pointer did since the last and gets the frame back, when
// it changed. One post a tick, as a post replaces one not yet delivered.
const Touch: ClientModule<Art, State> = (props, surface) => {
  if (surface.state === undefined) {
    const state: State = { queue: [] }
    surface.onPointer(event => state.queue.push(event.type))
    surface.every(Math.round(1000 / props.fps), () => surface.post({ events: state.queue.splice(0) }))
    surface.setState(state)
  }
  const { Box, Text } = surface.elements
  return (
    <Box flexDirection="column" width={props.columns} height={props.rows}>
      {props.art.map((row, r) => (
        <Text key={String(r)}>
          {row.map(([text, fg, bg], i) => (
            <Text key={String(i)} {...(fg === '' ? {} : { color: fg })} {...(bg === '' ? {} : { backgroundColor: bg })}>
              {text}
            </Text>
          ))}
        </Text>
      ))}
    </Box>
  )
}

export default Touch
