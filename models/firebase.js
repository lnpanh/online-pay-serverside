
import firebase from 'firebase/compat/app';
import * as firebaseui from 'firebaseui'
import 'firebaseui/dist/firebaseui.css'

const firebaseConfig = {
    apiKey: "AIzaSyAWy9R-DeZXjaBkPd2D1HoLYEXuPN7mMic",
    authDomain: "online-payment-bb087.firebaseapp.com",
    projectId: "online-payment-bb087",
    storageBucket: "online-payment-bb087.appspot.com",
    messagingSenderId: "449203698562",
    appId: "1:449203698562:web:312c855ad32c5ce75a2d9b",
    measurementId: "G-CB6D9XV3DY"
  };

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
export { auth, firebase };
