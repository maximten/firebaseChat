const firebase = require('firebase')
const readline = require('readline')
const process = require('process')
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

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

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
}

const store = {
  email: null,
  password: null,
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

const stateHandlers = {
  [states.REQUEST_EMAIL]: async (input) => {
    console.log(`Enter email`)
    setNextAction(states.GET_EMAIL)
    getLineAndRunNextAction()
  }, 
  [states.GET_EMAIL]: async (input) => {
    store.email = input
    setNextAction(states.REQUEST_PASSWORD)
    runNextAction()
  }, 
  [states.REQUEST_PASSWORD]: async (input) => {
    console.log(`Enter your password`)
    setNextAction(states.GET_PASSWORD)
    getLineAndRunNextAction()
  }, 
  [states.GET_PASSWORD]: async (input) => {
    store.password = input
    setNextAction(states.FETCH_USER)
    runNextAction()
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
    console.log('Welcome to the chat')
  }  
}

init()
rl.on('line', (line) => stateHandlers[currentState](line))
runNextAction()