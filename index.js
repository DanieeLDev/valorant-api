//importando modulos para o api
const cors = require('cors')
const express = require('express');
const { updateLastPinged, hasError, getCacheById, getFullVersion, updateCacheAccount, organizeRankText, adjustAccountName, clearAllCache } = require("./general-functions.js");
const { updateUsesDb, getMostUsedAccountDB, verifyAccountDb } = require("./dabatase-functions.js");
const ValorantAPI = require("unofficial-valorant-api")

// configurando variaveis iniciais
const app = express();

// app.use(express.json());
app.use(cors());

// portas que são escutadas
app.listen(process.env.PORT || 5000, () => {
    console.log('Servidor rodando do index.js =)')
})

app.get('/', async (request, response) => {
    await updateLastPinged();

    response.send("Bem-vindo(a)! Para consultar o rank deste ato informe a url completa! -> https://danieeldev-valorantapi.herokuapp.com/api/mmr/{regiao}/{nome}/{tag} = Exemplo: https://danieeldev-valorantapi.herokuapp.com/api/mmr/br/LOUD Coreano/LLL")
})

app.get('/api/version', (request, response) => {
    response.status(200)
    response.send(getFullVersion())
    return
})

app.get('/api/cache', (request, response) => {
    var res = "Acesso negado"
    const passwords = ['danieeldev', 'c4ldasdev']
    if (request.query.password && passwords.includes(request.query.password)) {
        if (request.query.clear) {
            clearAllCache();
        }
        res = getCacheById();
    }
    response.status(200)
    response.send(res)
    return
})
app.get('/api/mostUsedAccount', async (request, response) => {    
    res = await getMostUsedAccountDB();
    let nick = res.id.split('|')[1]
    let tag = res.id.split('|')[2]
    let chamadas = res.uses

    response.status(200)
    response.send(`${nick}#${tag} com ${chamadas} chamadas.`)
    return
})

app.get('/api/mmr/:region/:name/:tag', async (request, response) => {
    const region = request.params.region || "br"
    const name = adjustAccountName(request.params.name);
    const tag = request.params.tag

    const type = request.query.type || 0
    // types
    // 0 -> "Ouro 1 - 34 CR"
    // 1 -> "Ouro 1"
    // 2 -> "Radiante #12"
    // 3 -> "Radiante #12 - 412 CR"

    var statusCode = 404;
    var returnText = '< Nenhum dado encontrado na RIOT >';

    if (!region || !name || !tag) {
        response.status(statusCode)
        response.send("Informe todos os campos corretamente.")
        return
    }
    // verificar se tem no cache, se tem ja retorna pra ser mais rapido
    var cacheId = `${region}|${name}|${tag}`
    var cache = getCacheById(cacheId);
    if (cache && cache.ttl > new Date()) {
        console.log('retornando do cache')

        await updateUsesDb(cache.rank, region, name, tag);

        response.status(200)
        response.send(cache.rank)
        return
    }
    const mmr = await ValorantAPI.getMMR("v2", region, name, tag)

    var hasErrorMsg = hasError(mmr, mmr.status);
    if (hasErrorMsg) {
        // caso caiu a api ou nenhum dado foi encontrado, verifica no banco de dados se tem ultimo registro
        // se tiver altera o response para a ultima gravação feita
        var rank = await verifyAccountDb(region, name, tag)

        if (rank) {
            returnText = rank
            statusCode = 200

            updateCacheAccount(cacheId, rank);
            await updateUsesDb(rank, region, name, tag);

        } else {
            statusCode = 404
            returnText = hasErrorMsg
        }

        console.log('retornando valor do banco de dados')

        response.status(statusCode)
        response.send(returnText);
        return
    }

    const current_data = mmr.data.current_data
    var cr = current_data.ranking_in_tier || 0
    var fullRank = (current_data.currenttierpatched || '')

    var rank = await organizeRankText(type, cr, fullRank, region, name, tag);

    await updateUsesDb(rank, region, name, tag);

    // coloca no cache
    updateCacheAccount(cacheId, rank);
    console.log('retornando valor atualizado')

    returnText = rank

    response.status(statusCode)
    response.send(returnText)
    return response;
})