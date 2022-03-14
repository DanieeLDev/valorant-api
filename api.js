const version = '2.3'

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
    console.log('inicio ' + type)
    var a = fullRank.split(' ')[0].trim()
    var b = fullRank.split(' ')[1]

    if (type === 0) {
      console.log('entrou type 0 ' + a)
      if (a === 'Radiant') {
        resolve(`${getRankTraduction(a)}  - ${cr} CR`) // retorna "Radiante - 324 CR"
      } else {
        resolve(`${getRankTraduction(a)} ${b} - ${cr} CR`) //retorna "Ferro 3 - 23 CR"
      }
    }
    if (type === 1) {
      console.log('entrou type 1 ' + a)
      resolve(getRankTraduction(a)); // retorna "Ferro" "Radiante"
    }
    if (type === 2) {

      if (a === 'Radiant') {
        ValorantAPI.getLeaderboard(region, name, tag).then((leader) => {
          console.log(leader)
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
  var crRet = current_data.ranking_in_tier || 0
  console.log('antes do rank')
  var rank = await organizarRank(type, crRet, (current_data.currenttierpatched || ''), region, name, tag);
  console.log('depois do rank')
  await new Promise((resolve, reject) => { gravarContaDB(rank, region, name, tag, () => { resolve() }) })

  resJson = rank

  response.status(resStatus)
  response.json(resJson)
  return response;
})
