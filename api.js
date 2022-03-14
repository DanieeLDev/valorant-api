const version = "1.2 - Beta";

require('dotenv').config();
const { google } = require('googleapis');
const adminFB = require('firebase-admin')

var firebaseCredentials = require("./firebaseCredentials.json");
const express = require('express');
const app = express();

app.use(express.json());
// Initialize Firebase
const fbApp = adminFB.initializeApp({
    credential: adminFB.credential.cert(firebaseCredentials)
});

const fs = fbApp.firestore();

var fsGetToken = (token) => {
    return new Promise((resolve, reject) => {
        try {
            fs.collection('tokens').doc(token).get().then((doc) => {
                if (doc.exists) {
                    var data = doc.data()
                    resolve(data)
                } else {
                    resolve(null)
                }
            })
        } catch (error) {
            resolve(nul)
        }

    })
}

var initialize = async () => {
    // initialize google api
    const auth = new google.auth.GoogleAuth({ keyFile: 'sheetCredentials.json', scopes: 'https://www.googleapis.com/auth/spreadsheets' });
    const client = await auth.getClient();
    const googleSheet = google.sheets({ version: 'v4', auth: client });

    // portas que são escutadas
    app.listen(process.env.PORT || 5000, () => {
        console.log('Servidor rodando =)')
    })
    app.get('/', async (req, res) => {
        res.send("Contact me on Discord to get your license for FREE: DaNieL#4794")
    })
    app.get('/api/setduo', async (req, res) => {
        const token = req.query.token
        const searchQuery = req.query.search || ''
        if (!token) {
            res.send("Insira o token de acesso.")
            return
        }
        var dataToken = await fsGetToken(token);
        if (!dataToken || !dataToken.active) {
            res.send("Token inválido ou expirado")
            return
        }
        console.log('search =' + searchQuery)
        if (searchQuery && searchQuery.length > 0) {
            console.log('indo buscar na tabela')
            const getMetaData = await googleSheet.spreadsheets.values.get({ auth, spreadsheetId: dataToken.spreadsheetId, range: 'A:B' });
            const arrayValues = getMetaData.data.values;

            var duo = null
            var idx = 0
            var finishValue = false
            while (finishValue === false) {
                var line = arrayValues[idx]

                var colA = line[0]
                var colB = line[1]

                if (colA === searchQuery) {
                    duo = colB
                }
                idx++

                var nextline = arrayValues[idx]
                if (!nextline || duo) {

                    if (!duo) {
                        duo = searchQuery
                    }
                    finishValue = true
                }
            }

        } else {
            duo = "Solo no momento"
        }

        try {
            await fs.collection('tokens').doc(token).set({ duo }, { merge: true })
            res.send("O Duo foi atualizado para: " + duo);
        } catch (error) {
            res.send("ERRO! O duo não foi atualizado!");
        }
    })

    app.get('/api/getduo', async (req, res) => {
        const token = req.query.token
        if (!token) {
            res.send("Insira o token de acesso.")
            return
        }
        var dataToken = await fsGetToken(token);
        if (!dataToken || !dataToken.active) {
            res.send("Token inválido ou expirado")
            return
        }
        if (!dataToken.duo) {
            dataToken.duo = "Solo no momento"
        }
        res.send(dataToken.duo)
    })
    app.get('/api/version', async (req, res) => {
        res.send("FREE SheetsAPI powered by DanieelDev => v" + version)
    })
}

initialize()
