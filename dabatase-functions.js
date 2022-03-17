const adminFB = require('firebase-admin')

if (process.env.NODE_ENV !== 'production') { // se n for heroku
  require('dotenv').config() // pega os dados do .env
}
// Initialize Firebase
var serviceAccount = {
  type: "service_account",
  project_id: "valorant-api",
  private_key_id: process.env.CREDENTIALS_FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.CREDENTIALS_FIREBASE_PRIVATE_KEY,
  client_email: "valorant-api@appspot.gserviceaccount.com",
  client_id: process.env.CREDENTIALS_FIREBASE_CLIENT_ID,
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/valorant-api%40appspot.gserviceaccount.com"
}
const fbApp = adminFB.initializeApp({
  credential: adminFB.credential.cert(serviceAccount)
});

const fs = fbApp.firestore();

exports.updateUsesDb = (rank, region, name, tag) => {
  return new Promise((resolve, reject) => {
    try {
      var batch = fs.batch()
      var refAccount = fs.collection('accounts').doc(`${region}|${name}|${tag}`)
      batch.set(refAccount, { rank, uses: adminFB.firestore.FieldValue.increment(1) }, { merge: true })

      var refApi = fs.collection('api').doc('info')
      batch.set(refApi, { uses: adminFB.firestore.FieldValue.increment(1) }, { merge: true })

      batch.commit().then(() => {
        console.log('Atualizou banco de dados')
        resolve()
      })
    } catch (error) {
      console.log('Deu problema banco de dados')
      resolve()
    }
  })
}

exports.verifyAccountDb = (region, name, tag) => {
  return new Promise((resolve, reject) => {
    try {
      fs.collection('accounts').doc(`${region}|${name}|${tag}`).get().then((doc) => {
        var dados = {}
        if (doc.exists) {
          dados = doc.data()
        }
        resolve(dados.rank)
      })
    } catch (error) {
      resolve(null)
    }
  })

}
