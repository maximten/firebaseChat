const firebase = require('firebase')
const readline = require('readline')
const process = require('process')
const moment = require('moment')
const { firebaseConfig } = require('./config')

const init = () => {
  firebase.initializeApp(firebaseConfig)
}

const signUp = async (email, password) => (
  firebase.auth().createUserWithEmailAndPassword(email, password) 
)

const signIn = async (email, password) => (
  firebase.auth().signInWithEmailAndPassword(email, password) 
)

const getCurrentUser = async (email, password) => (
  firebase.auth().currentUser 
)

const loadCollection = async (collection) => (
  firebase.database().ref(collection).once('value')
)

const subscribeToCollection = async (collection, callback) => (
  firebase.database().ref(collection).on('child_added', callback)
)

const pushToCollection = (collection, data) => (
  firebase.database().ref(collection).push(data)
)

const printMessage = ({ email, message, time }) => {
  console.log(`[${moment(time).format('DD.MM.YYYY HH:mm:ss')}] ${email}: ${message}`)
} 

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

rl.stdoutMuted = false

rl._writeToOutput = function (stringToWrite) {
  if (rl.stdoutMuted) {
    rl.output.write("*")
  } else {
    rl.output.write(stringToWrite)
  }
}

const states = {
  STARTUP: 'STARTUP', 
  REQUEST_EMAIL: 'REQUEST_EMAIL', 
  GET_EMAIL: 'GET_EMAIL', 
  REQUEST_PASSWORD: 'REQUEST_PASSWORD', 
  GET_PASSWORD: 'GET_PASSWORD', 
  FETCH_USER: 'FETCH_USER', 
  CHECK_EMAIL_VERIFICATION: 'CHECK_EMAIL_VERIFICATION', 
  REQUEST_EMAIL_VERIFICATION: 'REQUEST_EMAIL_VERIFICATION', 
  START_CHAT: 'START_CHAT', 
  REQUEST_MESSAGE: 'REQUEST_MESSAGE', 
  GET_MESSAGE: 'GET_MESSAGE', 
}

const store = {
  email: null,
  password: null,
  messages: null
}

let currentState = states.REQUEST_EMAIL

const setNextAction = (state) => {
  currentState = state
}

const runNextAction = () => {
  stateHandlers[currentState]()
}

const getLineAndRunNextAction = () => {
  rl.prompt()
}

const loadMessages = async () => {
    const snap = await loadCollection('messages')
    store.messages = snap.val()
    Object.values(store.messages).forEach((message) => {
      printMessage(message)
    })
}

const stateHandlers = {
  [states.REQUEST_EMAIL]: async (input) => {
    console.log(`Enter email`)
    setNextAction(states.GET_EMAIL)
    getLineAndRunNextAction()
  }, 
  [states.GET_EMAIL]: async (input) => {
    if (input.match(/.+\@.+\..+/)) {
      store.email = input
      setNextAction(states.REQUEST_PASSWORD)
      runNextAction()
    } else {
      console.log('Email is not valid')
      setNextAction(states.REQUEST_EMAIL)
      runNextAction()
    }
  }, 
  [states.REQUEST_PASSWORD]: async (input) => {
    console.log(`Enter your password`)
    rl.stdoutMuted = true
    setNextAction(states.GET_PASSWORD)
    getLineAndRunNextAction()
  }, 
  [states.GET_PASSWORD]: async (input) => {
    console.log(`\n`)
    rl.stdoutMuted = false
    if (input.match(/.{6,}/)) {
      store.password = input
      setNextAction(states.FETCH_USER)
      runNextAction()
    } else {
      console.log('The password must be 6 characters long or more')
      setNextAction(states.REQUEST_PASSWORD)
      runNextAction()
    }
  },
  [states.FETCH_USER]: async (input) => {
    let user = null
    try {
      console.log('Trying to create new user...')
      user = await signUp(store.email, store.password)
      console.log('New user created')
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        console.log('User already exist, trying to sign in...')
        user = await signIn(store.email, store.password)
        console.log('Signed in successfully')
      } else {
        console.log('Sign in failed')
        setNextAction(states.REQUEST_EMAIL)
        runNextAction()
        return
      }
    }
    setNextAction(states.CHECK_EMAIL_VERIFICATION)
    runNextAction()
  }, 
  [states.CHECK_EMAIL_VERIFICATION]: async (input) => {
    // Signing in to fetch actual user data
    const { user } = await signIn(store.email, store.password)
    if (user.emailVerified) {
      console.log(`Your email is verified`)
      setNextAction(states.START_CHAT)
    } else {
      console.log(`Your email is not verified`)
      setNextAction(states.REQUEST_EMAIL_VERIFICATION)
    }
    runNextAction()
  },  
  [states.REQUEST_EMAIL_VERIFICATION]: async (input) => {
    const user = await getCurrentUser()
    console.log(`Sending verification email...`)
    await user.sendEmailVerification()
    console.log(`Verify your email and hit any key`)
    setNextAction(states.CHECK_EMAIL_VERIFICATION)
    getLineAndRunNextAction()
  },  
  [states.START_CHAT]: async (input) => {
    const user = await getCurrentUser()
    console.log('Welcome to the chat')
    console.log('Type "/quit" to exit')
    await loadMessages()
    subscribeToCollection('messages', (snap) => {
      const message = snap.val()
      const key = snap.key
      if (!store.messages.hasOwnProperty(key)) {
        store.messages[key] = message 
        printMessage(message)
      }
    })
    setNextAction(states.REQUEST_MESSAGE)
    runNextAction()
  },  
  [states.REQUEST_MESSAGE]: async (input) => {
    setNextAction(states.GET_MESSAGE)
    getLineAndRunNextAction()
  },  
  [states.GET_MESSAGE]: async (input) => {
    if (input === '/quit') {
      process.exit()
    } else {
      const user = await getCurrentUser()
      pushToCollection('messages', {
        email: user.email,
        message: input,
        time: (new Date()).toISOString()
      })
      setNextAction(states.REQUEST_MESSAGE)
      runNextAction()
    }
  },  
}

init()
rl.on('line', (line) => stateHandlers[currentState](line))
runNextAction()