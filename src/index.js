// import { testClient } from './userInterface/UI.js'

// testClient()

import { UI } from './userInterface/UI.js'
export default UI

// import termkit from 'terminal-kit'
// const term = termkit.terminal

// async function test() {
//     term.clear()

//     var sbuf = new termkit.ScreenBuffer({ dst: term })

//     var tbufHint = new termkit.TextBuffer()
//     tbufHint.setText('Barack Obama\nNewLine', false, { color: 'gray', italic: true })

//     var tbuf = new termkit.TextBuffer({ dst: sbuf, y: 10 })
//     //tbuf.setVoidAttr( { transparency: true } ) ;
//     tbuf.setVoidTextBuffer(tbufHint)
//     tbuf.setText('Barack')

//     tbuf.draw()
//     sbuf.draw()

//     // do nothing, just wait for 1 second
//     await new Promise((resolve) => setTimeout(resolve, 1000))

//     term.moveTo(1, 30)
// }

// test()
