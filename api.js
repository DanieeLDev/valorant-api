const version = '2.1'

// ********************************************************************************************************
// ********************************************************************************************************
// ***********************************            ÍNICIO               ************************************
// ***************************************        SISTEMA             *************************************
// *****************************************                     ******************************************
// ********************************************* **  **** ** **********************************************
// ********************************************************************************************************
//importando firebase
const adminFB = require('firebase-admin')

var serviceAccount = require("./ServiceAccountKey.json");

// importando valorant-api
const ValorantAPI = require("unofficial-valorant-api")
//importando modulos express/cors para o api
const cors = require('cors')
const express = require('express');
const { json } = require('express');
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
    return "< HTTPS 503 -  Tente novamente em alguns minutos>";
  }
  if (status === 404) {
    return "< Nenhum dado encontrado na RIOT >";
  }
  if (status === 429) {
    return "< API sobrecarregada, tente novamente em alguns minutos >";
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
var organizarRank = (fullRank) => {

  var a = fullRank.split(' ')[0].trim()
  var b = fullRank.split(' ')[1]


  if (a === 'Radiant') {
    // TODO: verificar se há como eu retornar o top dele na tabela
    return getRankTraduction(a); // retorna so radiante
  } else {
    return getRankTraduction(a) + ' ' + b; //retorna "Ferro 3"
  }
}
var verificarContaDB = async (region, name, tag, done) => {

  try {
    await fs.collection('accounts').doc(`${region}|${name}|${tag}`).get().then((doc) => {
      console.log(`Regiao ${region} - ${name}#${tag} => ${doc.exists}`)
      var dados = null
      if (doc.exists) {
        dados = doc.data()
        console.log(`${name}#${tag} => ${dados.rank}`)

        if (done) done(dados.rank)

      }
    })
  } catch (error) {
    if (done) done()
  }
}
var gravarContaDB = (rank, region, name, tag, done) => {
  try {
    fs.collection('accounts').doc(`${region}|${name}|${tag}`).set({ rank, usos: adminFB.firestore.FieldValue.increment(1) }, { merge: true }).then(() => {
      console.log('Atualizou banco de dados')
      if (done) done()
    })
  } catch (error) {
    console.log('Deu problema banco de dados')
    if (done) done()
  }
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

app.get('/api/database/:name/:tag', async (request, response) => {
  await fs.collection('accounts').doc('teste').set({ teste: true })
  response.json("Terminou")
  return response.status(200)
})

app.get('/', async (request, response) => {
  response.json("Bem-vindo(a)! Para consultar o rank deste ato informe a url completa! -> https://danieeldev-valorantapi.herokuapp.com/api/mmr/{regiao}/{nome}/{tag} = Exemplo: https://danieeldev-valorantapi.herokuapp.com/api/mmr/br/coreano/br1")
})

app.get('/api/version', (request, response) => {
  response.json(`FREE Valorant-API powered by DanieelDev => API v${version}`)
  return response.status(200)
})

app.get('/api/mmr/:region/:name/:tag', async (request, response) => {
  const region = request.params.region || "br"
  const name = request.params.name
  const tag = request.params.tag

  var resStatus = 404;
  var resJson = '< Nenhum dado encontrado na RIOT >';

  if (!region || !name || !tag) {
    response.json("Informe todos os campos corretamente.")
    return response.status(resStatus)
  }

  const mmr = await ValorantAPI.getMMR("v2", region, name, tag)

  // mmr.status = 503 // TESTE REMOVER


  var msgErro = temErro(mmr, mmr.status);
  if (msgErro) {
    // caso caiu a api ou nenhum dado foi encontrado, verifica no banco de dados se tem ultimo registro
    // se tiver altera o response para a ultima gravação feita
    var rank = null

    await verificarContaDB(region, name, tag, (acc) => { rank = acc })
    console.log('Tem rank: ' + rank)
    if (rank) {
      resJson = rank
      resStatus = 200
    } else {
      resStatus = 404
      resJson = msgErro
    }

    return response.status(resStatus).json(resJson);
  }

  const current_data = mmr.data.current_data
  var rank = organizarRank(current_data.currenttierpatched || '');

  var crRet = current_data.ranking_in_tier || 0
  var updatedRank = `${rank} - ${crRet} CR`


  await new Promise((resolve, reject) => { gravarContaDB(updatedRank, region, name, tag, () => { resolve() }) })

  resJson = updatedRank

  response.status(resStatus)
  response.json(resJson)
  return response;
})

app.get('/api/leaderboard/:region/:name/:tag', async (request, response) => {
  const region = request.params.region || "br"
  const name = request.params.name
  const tag = request.params.tag


  if (!region || !name || !tag) {
    response.json("Informe todos os campos corretamente.")
    return response.status(resStatus)
  }

  const mmr = await ValorantAPI.getLeaderboard(region, name, tag)

  if (mmr.status === 404) {
    return response.status(404).json("< Não há registro >")
  }
  response.status(200)
  response.json(`${name}#${tag} - #${mmr.data.data[0].leaderboardRank}`)
  return response;
})