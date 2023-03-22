import term from 'terminal-kit'
import { EventEmitter } from 'events'

var ScreenBuffer = term.ScreenBuffer
var TextBuffer = term.TextBuffer
var TextBox = term.TextBox

const terminal = term.terminal

export class UI extends EventEmitter {
    /************************* */
    // private fields

    /**
     * Holds all the ports added to the UI.
     */
    #ports = []

    // holds all the messages that fit in the messagePort buffer
    #messages = []
    #moreMessages = []

    #currentInput = null
    #msgPortWidth = 0
    #msgPortHeight = 0
    #currentMsgLines = 0

    #msgPortX = 1
    #msgPortY = 2

    #currentToken = ''

    #colorThemes = {}

    /************************* */

    /************************* */
    // public fields
    /**
     * The UI port. This is the port that the UI will use to display and update the UI.
     *
     * @type {ScreenBuffer}
     */
    uiPort = null

    /**
     * The message port. This is the port view port that the UI will use to display and update the messages in the chat.
     *
     * @type {ScreenBuffer}
     * @public
     */
    messagePort = null

    /**
     * The message box. This is the box that the UI will use to display the messages in the chat.
     *
     * @type {TextBox}
     */
    messageBox = null

    /**
     * The terminal instance. This is the terminal instance that the UI will use to display the UI. The UI will be made of the different ports (messagePort, inputPort, etc.).
     *
     * @type {Terminal}
     */
    terminal = null

    #msgPrompt = 'Type your message: '
    /**
     * The UI constructor.
     *
     * @constructor
     */
    constructor() {
        super()
    }

    // display the messages

    // get input from user

    // display ui (e.g., the menu)

    // start the chat ui
    /**
     * Starts the UI.
     *
     * This method should be called after the UI object is created.
     * It will display the UI and start listening for user input.
     *
     */
    start(callback) {
        term.getDetectedTerminal((error, detectedTerm) => {
            if (error) {
                console.log('Error: ' + error)
                return
            }

            // Initialize the terminal.
            this.terminal = detectedTerm
            this.#setThemes()

            // Initialize the UI port.
            this.uiPort = new ScreenBuffer({
                dst: this.terminal,
                width: Math.min(this.terminal.width),
                height: Math.min(this.terminal.height - 1),
                x: 0,
                y: 0,
            })

            // Update the message port width and height.
            this.#msgPortWidth = Math.min(this.terminal.width / 2)
            this.#msgPortHeight = Math.min(this.terminal.height - 1) - 4

            this.#addPort(this.uiPort)
            // Create the message box.
            this.#addPort(this.#createMessageBuffer())

            // Grab the special key inputs (e.g., CTRL_C).
            this.terminal.on('key', this.#keyInputs.bind(this))

            // clear the screen
            this.terminal.clear()

            // Detect user input
            this.terminal.moveTo(1, this.terminal.height - 1, this.#msgPrompt)
            this.#detectInput()

            // Draw the UI.
            this.messagePort.draw()
            this.uiPort.draw()

            // Call the callback function.
            if (callback) callback()
        })
    }

    /**
     * Adds a new message to the UI.
     *
     * @param {object} message - The message to add.
     * @param {string} message.message - The message.
     */
    addNewMessage(msgObject) {
        if (!this.messagePort) {
            this.terminal.error('messagePort not initialized')
            // console.log('messagePort not initialized')
            return
        }

        if (msgObject.message === undefined || msgObject.message == '') return

        // Add the message to the message buffer.
        this.#messages.push(msgObject)

        // Calculate how many lines are needed to display the message.
        const username = msgObject.username ? msgObject.username : 'Anonymous'
        const msgWidth = msgObject.message.length + username.length + 2
        this.#currentMsgLines += Math.ceil(msgWidth / this.messagePort.width)

        // Check if the message buffer is full.
        if (this.#currentMsgLines >= this.#msgPortHeight) {
            // Remove the last message and add to the more messages array.
            this.#moreMessages.push(this.#messages.shift())

            // Shift the messages up.
            this.#shiftMessagePortUp()
        } else {
            // Add the message to the message port.
            this.#addMessageToMessagePort(msgObject)
        }

        // Reset the cursor
        // this.terminal.moveTo(1, this.terminal.height, this.#currentToken)
        // this.terminal.restoreCursor()

        if (this.#currentInput) {
            this.#currentInput.redraw()
        }
    }

    // ************************************************************
    // ************* U T I L I T I E S  ***************************
    // ************************************************************

    #shiftMessagePortUp() {
        this.messagePort.setText(this.#messages.map((msg) => this.#formatMessage(msg)).join(''))
        this.messagePort.draw()
        this.uiPort.draw()
    }

    #addMessageToMessagePort(msgObject) {
        const formattedMessage = this.#formatMessage(msgObject)

        this.messagePort.append(formattedMessage)
        this.messagePort.draw()
        this.uiPort.draw()
    }

    #formatMessage(msgObject) {
        const message = msgObject.message
        const username = msgObject.username ? msgObject.username : 'Anonymous'
        // this.terminal.colorRgbHex(msgObject.color)
        const str = this.terminal.str(`\n${username}: ${message}`)
        return str
    }

    #detectInput() {
        this.#currentInput = this.terminal.inputField(
            {
                // autoCompleteMenu: true,
                // autoComplete: ['hello', 'world'],
                // autoCompleteHint: true,
                // autoCompleteHintStyle: this.terminal.brightBlack.bgBrightWhite,
                history: true,
                tokenHook: (token, isEndOfInput, previousTokens, term, config) => {
                    this.#currentToken = previousTokens + token

                    this.terminal.saveCursor()
                },
            },
            (error, input) => {
                if (input !== '') {
                    this.emit('confirmInput', input)
                }

                this.terminal.eraseLine()
                this.terminal.moveTo(1, this.terminal.height - 1, this.#msgPrompt)
                // this.terminal.saveCursor()
                this.#detectInput()
            }
        )
    }

    #keyInputs(key) {
        switch (key) {
            case 'CTRL_C':
                this.terminal.grabInput(false)
                process.exit()
                break
            // backspace
            // case 'BACKSPACE':
            //     this.#currentToken = this.#currentToken.slice(0, -1)
            //     this.terminal.moveTo(1, this.terminal.height, this.#currentToken)
            //     break
            case 'UP':
                break
            default:
                break
        }
    }

    #createMessageBuffer() {
        this.messagePort = new TextBuffer({
            dst: this.uiPort,
            x: this.#msgPortX,
            y: this.#msgPortY,
            width: this.#msgPortWidth,
            height: this.#msgPortHeight,
        })

        // this.messagePort.defaultStyle = this.terminal.brightWhite.bgBrightBlack
        // console.log('messagePort: ', this.messagePort.buffer)
        return this.messagePort
    }

    #addPort(port) {
        this.#ports.push(port)
    }

    #drawUI() {
        this.ports.forEach((port) => {
            port.draw()
        })
    }

    #setThemes() {
        this.#colorThemes = {
            '#ff0000': this.terminal.brightRed,
            '#00ff00': this.terminal.brightGreen,
            '#0000ff': this.terminal.brightBlue,
            '#ffa500': this.terminal.brightYellow,
            '#800080': this.terminal.brightMagenta,
            '#008080': this.terminal.brightCyan,
            '#ffffff': this.terminal.brightWhite,
        }
    }

    #displayMenu() {}
}

// ************************************************************
// ************* C L I E N T   C O D E   **********************
// ************************************************************
export const testClient = async () => {
    const chatMessages = [
        {
            username: 'Alice',
            message: "Hey, what's up?",
            color: '#ff0000',
        },
        {
            username: 'Bob',
            message: 'Not much, just hanging out.',
            color: '#00ff00',
        },
        {
            username: 'Charlie',
            message: 'Hey guys, what are you up to?',
            color: '#0000ff',
        },
        {
            username: 'David',
            message: 'Just finished watching a movie. How about you?',
            color: '#ffa500',
        },
        {
            username: 'Eve',
            message: "I'm studying for an exam tomorrow. Wish me luck!",
            color: '#800080',
        },
        {
            username: 'Frank',
            message: 'Good luck, Eve! What exam is it?',
            color: '#008080',
        },
        {
            username: 'Grace',
            message: "Hey everyone, what's new?",
            color: '#ff00ff',
        },
        {
            username: 'Helen',
            message: 'I just got back from a jog. Feeling great!',
            color: '#00ffff',
        },
        {
            username: 'Isaac',
            message: "I'm trying to decide what to make for dinner tonight.",
            color: '#ffff00',
        },
        {
            username: 'Jack',
            message: 'How about spaghetti and meatballs?',
            color: '#f08080',
        },
        {
            username: 'Karen',
            message: "I'm not a fan of spaghetti. How about pizza instead?",
            color: '#808080',
        },
        {
            username: 'Liam',
            message: "I'm down for pizza!",
            color: '#ffa07a',
        },
        {
            username: 'Mia',
            message: 'Me too!',
            color: '#87cefa',
        },
        {
            username: 'Nate',
            message: 'I have a question. Has anyone seen my keys?',
            color: '#9370db',
        },
        {
            username: 'Olivia',
            message: 'Nope, sorry Nate.',
            color: '#3cb371',
        },
        {
            username: 'Peter',
            message: 'Maybe check the kitchen counter?',
            color: '#6495ed',
        },
        {
            username: 'Quinn',
            message: "I'm out with friends tonight. Anyone want to join?",
            color: '#f5deb3',
        },
        {
            username: 'Rachel',
            message: 'I wish I could, but I have to work tonight.',
            color: '#d3d3d3',
        },
        {
            username: 'Sam',
            message: "Sounds fun, but I'm taking a break from going out this week.",
            color: '#b0e0e6',
        },
        {
            username: 'Tom',
            message: 'Maybe another time, Quinn. Have a great night!',
            color: '#bdb76b',
        },
    ]

    const ui = new UI()
    ui.start(async () => {
        // a paragraph of text that will be wrapped
        const lorem =
            'lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec auctor, nisl eget ultricies tincidunt, nisl nisl aliquam nisl, eget aliquam nisl nisl eget nisl.'

        ui.addNewMessage({ message: lorem })

        ui.on('confirmInput', (input) => {
            ui.addNewMessage({ message: input })
        })

        for (let i = 0; i < chatMessages.length; i++) {
            ui.addNewMessage(chatMessages[i])
            // add a delay to simulate a real chat
            await new Promise((resolve) => setTimeout(resolve, 1000))
        }
    })
}
