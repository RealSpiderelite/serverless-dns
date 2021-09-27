/*
 * Copyright (c) 2021 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

var DNSParserWrap = require("./dnsParserWrap.js").DNSParserWrap

class DNSBlock {
    constructor() {
        this.dnsParser = new DNSParserWrap()
    }
    /*
    param.userBlocklistInfo
    param.blocklistFilter
    param.requestBodyBuffer
    param.event
    */
    async RethinkModule(param) {
        let response = {}
        response.isException = false
        response.exceptionStack = ""
        response.exceptionFrom = ""
        response.data = {}
        response.data.isBlocked = false
        response.data.isNotBlockedExistInBlocklist = false
        response.data.domainNameInBlocklistUint
        response.data.domainNameUserBlocklistIntersection
        response.data.decodedDnsPacket
        response.data.blockedB64Flag = ""
        try {
            let decodedDnsPacket = await this.dnsParser.Decode(param.requestBodyBuffer)
            if (param.userBlocklistInfo.isValidFlag) {
                let domainNameBlocklistInfo
                if ((decodedDnsPacket.questions.length >= 1) && (decodedDnsPacket.questions[0].type == "A" || decodedDnsPacket.questions[0].type == "AAAA" || decodedDnsPacket.questions[0].type == "CNAME")) {
                    domainNameBlocklistInfo = param.blocklistFilter.getDomainInfo(decodedDnsPacket.questions[0].name, param.event)
                    if (domainNameBlocklistInfo.data.searchResult) {
                        response.data = checkDomainBlocking(param.userBlocklistInfo, domainNameBlocklistInfo, param.blocklistFilter, decodedDnsPacket.questions[0].name)
                    }
                }
            }
            response.data.decodedDnsPacket = decodedDnsPacket
        }
        catch (e) {
            response.isException = true
            response.exceptionStack = e.stack
            response.exceptionFrom = "DNSBlock RethinkModule"
            response.data = false
        }
        return response
    }
}

function checkDomainBlocking(userBlocklistInfo, domainNameBlocklistInfo, blocklistFilter, domainName) {
    let response
    try {
        response = checkDomainNameUserFlagIntersection(userBlocklistInfo.userBlocklistFlagUint, userBlocklistInfo.flagVersion, domainNameBlocklistInfo, blocklistFilter, domainName)
        if (response.isBlocked) {
            return response
        }

        if (userBlocklistInfo.userServiceListUint) {
            let dnSplit = domainName.split(".")
            let dnJoin = ""
            let wildCardResponse
            while (dnSplit.shift() != undefined) {
                dnJoin = dnSplit.join(".")
                wildCardResponse = checkDomainNameUserFlagIntersection(userBlocklistInfo.userServiceListUint, userBlocklistInfo.flagVersion, domainNameBlocklistInfo, blocklistFilter, dnJoin)
                if (wildCardResponse.isBlocked) {
                    return wildCardResponse
                }
            }
        }
    }
    catch (e) {
        throw e
    }

    return response
}

function checkDomainNameUserFlagIntersection(userBlocklistFlagUint, flagVersion, domainNameBlocklistInfo, blocklistFilter, domainName) {
    let response = {}
    try {
        response.isBlocked = false
        response.isNotBlockedExistInBlocklist = false
        response.blockedB64Flag = ""
        response.domainNameInBlocklistUint
        response.domainNameUserBlocklistIntersection
        if (domainNameBlocklistInfo.data.searchResult.has(domainName)) {
            response.domainNameInBlocklistUint = domainNameBlocklistInfo.data.searchResult.get(domainName)
            response.domainNameUserBlocklistIntersection = blocklistFilter.flagIntersection(userBlocklistFlagUint, response.domainNameInBlocklistUint)
            if (response.domainNameUserBlocklistIntersection) {
                response.isBlocked = true
                response.blockedB64Flag = blocklistFilter.getB64FlagFromUint16(response.domainNameUserBlocklistIntersection, flagVersion)
            }
            else {
                response.isNotBlockedExistInBlocklist = true
                let uint16ArrConversion = new Uint16Array(response.domainNameInBlocklistUint.length)
                let index = 0
                for (let singleBlock of response.domainNameInBlocklistUint) {
                    uint16ArrConversion[index] = singleBlock
                    index++
                }
                response.blockedB64Flag = blocklistFilter.getB64FlagFromUint16(uint16ArrConversion, flagVersion)
            }
        }
    }
    catch (e) {
        throw e
    }
    return response
}


module.exports.DNSBlock = DNSBlock