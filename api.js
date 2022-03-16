var package = require('./package.json') // pega o package

if (process.env.NODE_ENV !== 'production') { // se n for heroku
  require('dotenv').config() // pega os dados do .env
}


// ********************************************************************************************************
// ********************************************************************************************************
// ***********************************            ÍNICIO               ************************************
// ***************************************        SISTEMA             *************************************
// *****************************************                     ******************************************
// ********************************************* **  **** ** **********************************************
// ********************************************************************************************************
//importando firebase
const adminFB = require('firebase-admin')

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

// importando valorant-api
const ValorantAPI = require("unofficial-valorant-api")
//importando modulos express/cors para o api
const cors = require('cors')
const express = require('express');
const app = express();

app.use(express.json());
app.use(cors());


//configurando firebase

// Initialize Firebase
const fbApp = adminFB.initializeApp({
  credential: adminFB.credential.cert(serviceAccount)
});

const fs = fbApp.firestore();


// ********************************************************************************************************
// ********************************************************************************************************
// ***********************************         VARIÁVEIS               ************************************
// ***************************************      GLOBAIS               *************************************
// *****************************************                     ******************************************
// ********************************************* **  **** ** **********************************************
// ********************************************************************************************************

var cache = {}

var listRanks = {
  Iron: 'Ferro',
  Bronze: 'Bronze',
  Silver: 'Prata',
  Gold: 'Ouro',
  Platinum: 'Platina',
  Diamond: 'Diamante',
  Immortal: 'Imortal',
  Radiant: 'Radiante',
  Unrated: 'Sem elo/rank'
}

var temErro = (mmr, status) => {
  if (!status) {
    return "< Nenhum dado foi encontrado na RIOT >";
  }
  if (status === 503) {
    return "< HTTPS 503 - Tente novamente em alguns minutos>";
  }
  if (status === 404) {
    return "< Nenhum dado encontrado na RIOT >";
  }
  if (status === 429) {

    if (mmr.ratelimits && mmr.ratelimits.remaining && mmr.ratelimits.remaining > 0) {
      return '< Conta não encontrada, verifique os caracteres especiais e tente novamente >'
    }
    return "< API sobrecarregada, - Tente novamente em alguns minutos >";
  }
  if (!mmr.data.current_data) {
    return `< Nenhum dado encontrado. (${status})>`;
  }
  if (!mmr.data.current_data.currenttierpatched) {
    return `< Sem dados desse ato. (${status})>`;
  }

  return null
}

var getRankTraduction = (a) => {
  return listRanks[a] || listRanks['Unrated'];
}
var organizarRank = (type, cr, fullRank, region, name, tag) => {
  return new Promise((resolve, reject) => {
    type = Number(type)

    var a = fullRank.split(' ')[0].trim()
    var b = fullRank.split(' ')[1]

    if (type === 0) {

      if (a === 'Radiant') {
        resolve(`${getRankTraduction(a)} - ${cr} CR`) // retorna "Radiante - 324 CR"
      } else {
        resolve(`${getRankTraduction(a)} ${b} - ${cr} CR`) //retorna "Ferro 3 - 23 CR"
      }
    }
    if (type === 1) {

      resolve(getRankTraduction(a)); // retorna "Ferro" "Radiante"
    }
    if (type === 2) {

      if (a === 'Radiant') {
        ValorantAPI.getLeaderboard(region, name, tag).then((leader) => {

          if (leader.status === 404) {
            resolve(getRankTraduction(a)); // deu erro retorna so "Radiante"
          } else {
            resolve(`${getRankTraduction(a)} #${leader.data.data[0].leaderboardRank}`) // retorna "Radiante #15"
          }
        }).catch(() => { resolve(getRankTraduction(a)) })
      } else {
        resolve(getRankTraduction(a)); // retorna so "Imortal"
      }

    }
    if (type === 3) {
      if (a === 'Radiant') {
        ValorantAPI.getLeaderboard(region, name, tag).then((leader) => {
          if (leader.status === 404) {
            resolve(`${getRankTraduction(a)} - ${cr} CR`) //retorna "Ferro 3 - 23 CR"
          } else {
            resolve(`${getRankTraduction(a)} #${leader.data.data[0].leaderboardRank} - ${cr} CR`) // retorna "Radiante #15 - 316 CR"
          }
        }).catch(() => { resolve(getRankTraduction(a)) })
      } else {
        resolve(`${getRankTraduction(a)} ${b} - ${cr} CR`) //retorna "Ferro 3 - 23 CR"
      }

    }
  })


}
var verificarContaDB = async (region, name, tag, done) => {

  try {
    await fs.collection('accounts').doc(`${region}|${name}|${tag}`).get().then((doc) => {
      var dados = null
      if (doc.exists) {
        dados = doc.data()

        if (done) done(dados.rank)

      }
    })
  } catch (error) {
    if (done) done()
  }
}
var atualizarContaDB = (rank, region, name, tag, done) => {
  try {
    var batch = fs.batch()
    var refAccount = fs.collection('accounts').doc(`${region}|${name}|${tag}`)
    batch.set(refAccount, { rank, uses: adminFB.firestore.FieldValue.increment(1) }, { merge: true })

    var refApi = fs.collection('api').doc('info')
    batch.set(refApi, { uses: adminFB.firestore.FieldValue.increment(1) }, { merge: true })

    batch.commit().then(() => {
      console.log('Atualizou banco de dados')
      if (done) done()
    })
  } catch (error) {
    console.log('Deu problema banco de dados')
    if (done) done()
  }
}
var atualizarUsoDB = (region, name, tag, done) => {
  try {
    var batch = fs.batch()
    var refAccount = fs.collection('accounts').doc(`${region}|${name}|${tag}`)
    batch.set(refAccount, { uses: adminFB.firestore.FieldValue.increment(1) }, { merge: true })

    var refApi = fs.collection('api').doc('info')
    batch.set(refApi, { uses: adminFB.firestore.FieldValue.increment(1) }, { merge: true })

    batch.commit().then(() => {
      console.log('Atualizou banco de dados')
      if (done) done()
    })
  } catch (error) {
    console.log('Deu problema banco de dados')
    if (done) done()
  }
}
var limparCacheAntigo = () => {
  Object.entries(cache).forEach(([key, conta]) => {
    if (conta.ttl < new Date()) {
      delete cache[key]
    }
  });
}
var atualizarCache = (id, rank) => {
  var oDate = new Date()
  oDate.setMinutes(oDate.getMinutes() + 10) // esse cache é valido por 10min
  cache[id] = {
    rank,
    ttl: oDate
  }
  console.log('atualizando cache')

  limparCacheAntigo(); // verifica se tem algum cache antigo e deleta
}

// ********************************************************************************************************
// ********************************************************************************************************
// ***********************************             PORTAS              ************************************
// ***************************************                            *************************************
// *****************************************                     ******************************************
// ********************************************* **  **** ** **********************************************
// ********************************************************************************************************

// portas que são escutadas
app.listen(process.env.PORT || 5000, () => {
  console.log('Servidor rodando =)')
})

app.get('/', async (request, response) => {
  response.json("Bem-vindo(a)! Para consultar o rank deste ato informe a url completa! -> https://danieeldev-valorantapi.herokuapp.com/api/mmr/{regiao}/{nome}/{tag} = Exemplo: https://danieeldev-valorantapi.herokuapp.com/api/mmr/br/coreano/br1")
})

app.get('/api/version', (request, response) => {
  response.json(`FREE Valorant-API powered by DanieelDev => API v${package.version}`)
  return response.status(200)
})

app.get('/api/cache', (request, response) => {
  var res = "Acesso negado"
  if (request.query.password && request.query.password === 'danieeldev') {
    res = cache
  }
  response.json(res)
  return response.status(200)
})

app.get('/api/mmr/:region/:name/:tag', async (request, response) => {
  const region = request.params.region || "br"
  const name = request.params.name
  const tag = request.params.tag

  const type = request.query.type || 0
  // types
  // 0 -> "Ouro 1 - 34 CR"
  // 1 -> "Ouro 1"
  // 2 -> "Radiante #12"
  // 3 -> "Radiante #12 - 412 CR"

  var resStatus = 404;
  var resJson = '< Nenhum dado encontrado na RIOT >';

  if (!region || !name || !tag) {
    response.json("Informe todos os campos corretamente.")
    return response.status(resStatus)
  }
  // verificar se tem no cache, se tem ja retorna pra ser mais rapido
  var cacheId = `${region}|${name}|${tag}`
  if (cache[cacheId] && cache[cacheId].ttl > new Date()) {
    console.log('retornando do cache')
    response.status(200)
    response.json(cache[cacheId].rank)

    await new Promise((resolve, reject) => { atualizarUsoDB(region, name, tag, () => { resolve() }) })

    return
  }
  const mmr = await ValorantAPI.getMMR("v2", region, name, tag)

  // mmr.status = 503 // TESTE REMOVER


  var msgErro = temErro(mmr, mmr.status);
  if (msgErro) {
    // caso caiu a api ou nenhum dado foi encontrado, verifica no banco de dados se tem ultimo registro
    // se tiver altera o response para a ultima gravação feita
    var rank = null

    await verificarContaDB(region, name, tag, (acc) => { rank = acc })

    if (rank) {
      resJson = rank
      resStatus = 200
    } else {
      resStatus = 404
      resJson = msgErro
    }
    atualizarCache(cacheId, rank);
    console.log('retornando valor do banco de dados')

    await new Promise((resolve, reject) => { atualizarUsoDB(region, name, tag, () => { resolve() }) })

    return response.status(resStatus).json(resJson);
  }

  const current_data = mmr.data.current_data
  var crRet = current_data.ranking_in_tier || 0

  var rank = await organizarRank(type, crRet, (current_data.currenttierpatched || ''), region, name, tag);
  await new Promise((resolve, reject) => { atualizarContaDB(rank, region, name, tag, () => { resolve() }) })

  // coloca no cache
  atualizarCache(cacheId, rank);
  console.log('retornando valor atualizado')

  resJson = rank

  response.status(resStatus)
  response.json(resJson)
  return response;
})
