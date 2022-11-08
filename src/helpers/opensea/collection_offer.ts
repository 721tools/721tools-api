import { gotScraping } from 'got-scraping';
import { TypedDataUtils, SignTypedDataVersion } from '@metamask/eth-sig-util';
import { RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';
import { SignType } from '../../model/sign-type';

const limiterFlexible = new RateLimiterMemory({
    points: 1,
    duration: 0.2,
})
const limiterQueue = new RateLimiterQueue(limiterFlexible);

export const preCreateCollectionOffer = async (kmsSigner, smartAddress, contractAddress, slug, trait, price, days) => {
    await limiterQueue.removeTokens(1);
    const createCollectionOfferActionModalQuery = {
        id: "CreateCollectionOfferActionModalQuery",
        query: "query CreateCollectionOfferActionModalQuery(\n  $price: PaymentAssetQuantityInputType!\n  $closedAt: DateTime!\n  $assetContract: AssetContractInputType!\n  $collection: CollectionSlug!\n  $trait: StringTraitConfig\n) {\n  blockchain {\n    createCollectionOfferActions(price: $price, closedAt: $closedAt, assetContract: $assetContract, collection: $collection, trait: $trait) {\n      __typename\n      ...BaseCreateOrderActionModal_actions\n    }\n  }\n}\n\nfragment AskForDepositAction_data on AskForDepositType {\n  asset {\n    chain {\n      identifier\n    }\n    decimals\n    symbol\n    usdSpotPrice\n    id\n  }\n  minQuantity\n}\n\nfragment AskForSwapAction_data on AskForSwapType {\n  __typename\n  fromAsset {\n    chain {\n      identifier\n    }\n    decimals\n    symbol\n    id\n  }\n  toAsset {\n    chain {\n      identifier\n    }\n    symbol\n    id\n  }\n  minQuantity\n  maxQuantity\n  ...useHandleBlockchainActions_ask_for_asset_swap\n}\n\nfragment AssetApprovalAction_data on AssetApprovalActionType {\n  __typename\n  method {\n    __typename\n    ... on TransactionSubmissionDataType {\n      chain {\n        identifier\n      }\n    }\n  }\n  ...useHandleBlockchainActions_approve_asset\n}\n\nfragment AssetFreezeMetadataAction_data on AssetFreezeMetadataActionType {\n  __typename\n  method {\n    __typename\n    ... on TransactionSubmissionDataType {\n      chain {\n        identifier\n      }\n    }\n  }\n  ...useHandleBlockchainActions_freeze_asset_metadata\n}\n\nfragment AssetItem_asset on AssetType {\n  displayName\n  relayId\n  collection {\n    name\n    id\n  }\n  ...AssetMedia_asset\n}\n\nfragment AssetItem_bundle_asset on AssetType {\n  relayId\n  ...AssetMedia_asset\n}\n\nfragment AssetMediaAnimation_asset on AssetType {\n  ...AssetMediaImage_asset\n}\n\nfragment AssetMediaAudio_asset on AssetType {\n  backgroundColor\n  ...AssetMediaImage_asset\n}\n\nfragment AssetMediaContainer_asset_2V84VL on AssetType {\n  backgroundColor\n  ...AssetMediaEditions_asset_2V84VL\n}\n\nfragment AssetMediaEditions_asset_2V84VL on AssetType {\n  decimals\n}\n\nfragment AssetMediaImage_asset on AssetType {\n  backgroundColor\n  imageUrl\n  collection {\n    displayData {\n      cardDisplayStyle\n    }\n    id\n  }\n}\n\nfragment AssetMediaPlaceholderImage_asset on AssetType {\n  collection {\n    displayData {\n      cardDisplayStyle\n    }\n    id\n  }\n}\n\nfragment AssetMediaVideo_asset on AssetType {\n  backgroundColor\n  ...AssetMediaImage_asset\n}\n\nfragment AssetMediaWebgl_asset on AssetType {\n  backgroundColor\n  ...AssetMediaImage_asset\n}\n\nfragment AssetMedia_asset on AssetType {\n  animationUrl\n  displayImageUrl\n  imageUrl\n  isDelisted\n  ...AssetMediaAnimation_asset\n  ...AssetMediaAudio_asset\n  ...AssetMediaContainer_asset_2V84VL\n  ...AssetMediaImage_asset\n  ...AssetMediaPlaceholderImage_asset\n  ...AssetMediaVideo_asset\n  ...AssetMediaWebgl_asset\n}\n\nfragment AssetSwapAction_data on AssetSwapActionType {\n  __typename\n  method {\n    chain {\n      identifier\n    }\n  }\n  ...useHandleBlockchainActions_swap_asset\n}\n\nfragment AssetTransferAction_data on AssetTransferActionType {\n  __typename\n  method {\n    __typename\n    ... on TransactionSubmissionDataType {\n      chain {\n        identifier\n      }\n    }\n  }\n  ...useHandleBlockchainActions_transfer_asset\n}\n\nfragment BaseCreateOrderActionModal_actions on BlockchainActionType {\n  __isBlockchainActionType: __typename\n  ...BlockchainActionList_data\n  ...OrderDataHeader_getOrderDataFromActions\n}\n\nfragment BlockchainActionList_data on BlockchainActionType {\n  __isBlockchainActionType: __typename\n  __typename\n  ... on AssetApprovalActionType {\n    ...AssetApprovalAction_data\n  }\n  ... on AskForDepositType {\n    __typename\n    ...AskForDepositAction_data\n  }\n  ... on AskForSwapType {\n    __typename\n    ...AskForSwapAction_data\n  }\n  ... on AssetFreezeMetadataActionType {\n    __typename\n    ...AssetFreezeMetadataAction_data\n  }\n  ... on AssetSwapActionType {\n    __typename\n    ...AssetSwapAction_data\n  }\n  ... on AssetTransferActionType {\n    __typename\n    ...AssetTransferAction_data\n  }\n  ... on CreateOrderActionType {\n    __typename\n    ...CreateOrderAction_data\n  }\n  ... on CancelOrderActionType {\n    __typename\n    ...CancelOrderAction_data\n  }\n  ... on FulfillOrderActionType {\n    __typename\n    ...FulfillOrderAction_data\n  }\n  ... on PaymentAssetApprovalActionType {\n    __typename\n    ...PaymentAssetApprovalAction_data\n  }\n  ... on WaitForBalanceActionType {\n    __typename\n    ...WaitForBalanceAction_data\n  }\n  ... on MintActionType {\n    __typename\n    ...MintAction_data\n  }\n}\n\nfragment CancelOrderAction_data on CancelOrderActionType {\n  __typename\n  method {\n    __typename\n    ... on TransactionSubmissionDataType {\n      chain {\n        identifier\n      }\n    }\n  }\n  ...useHandleBlockchainActions_cancel_orders\n}\n\nfragment ConfirmationItem_asset on AssetType {\n  ...AssetItem_asset\n}\n\nfragment ConfirmationItem_asset_item_payment_asset on AssetType {\n  ...ConfirmationItem_extra_payment_asset\n  ...ConfirmationItem_footer_payment_asset\n}\n\nfragment ConfirmationItem_assets on AssetType {\n  ...ConfirmationItem_asset\n  ...ConfirmationItem_bundle_asset\n}\n\nfragment ConfirmationItem_bundle_asset on AssetType {\n  ...AssetItem_bundle_asset\n}\n\nfragment ConfirmationItem_bundle_asset_payment_asset on AssetType {\n  ...ConfirmationItem_extra_payment_asset\n  ...ConfirmationItem_footer_payment_asset\n}\n\nfragment ConfirmationItem_extra_payment_asset on AssetType {\n  ...PriceTag_paymentAsset\n  usdSpotPrice\n}\n\nfragment ConfirmationItem_footer_payment_asset on AssetType {\n  symbol\n  usdSpotPrice\n}\n\nfragment ConfirmationItem_payment_asset on AssetType {\n  ...ConfirmationItem_asset_item_payment_asset\n  ...ConfirmationItem_bundle_asset_payment_asset\n}\n\nfragment CreateOrderAction_data on CreateOrderActionType {\n  __typename\n  method {\n    chain {\n      identifier\n    }\n  }\n  orderData {\n    side\n    isCounterOrder\n  }\n  ...useHandleBlockchainActions_create_order\n}\n\nfragment FulfillOrderAction_data on FulfillOrderActionType {\n  __typename\n  method {\n    __typename\n    ... on TransactionSubmissionDataType {\n      chain {\n        identifier\n      }\n    }\n  }\n  orderData {\n    side\n  }\n  ...useHandleBlockchainActions_fulfill_order\n}\n\nfragment MintAction_data on MintActionType {\n  __typename\n  method {\n    __typename\n    chain {\n      identifier\n    }\n  }\n  ...useHandleBlockchainActions_mint_asset\n}\n\nfragment OrderDataHeader_getOrderDataFromActions on BlockchainActionType {\n  __isBlockchainActionType: __typename\n  ... on CreateOrderActionType {\n    orderData {\n      ...OrderDataHeader_order\n    }\n  }\n  ... on FulfillOrderActionType {\n    orderData {\n      ...OrderDataHeader_order\n    }\n  }\n}\n\nfragment OrderDataHeader_order on OrderDataType {\n  item {\n    __typename\n    ... on AssetQuantityDataType {\n      asset {\n        ...ConfirmationItem_assets\n        id\n      }\n      quantity\n    }\n    ... on AssetBundleType {\n      name\n      assetQuantities(first: 20) {\n        edges {\n          node {\n            asset {\n              ...ConfirmationItem_assets\n              id\n            }\n            id\n          }\n        }\n      }\n    }\n    ... on AssetBundleToBeCreatedType {\n      name\n      assetQuantitiesToBeCreated: assetQuantities {\n        asset {\n          ...ConfirmationItem_assets\n          id\n        }\n        quantity\n      }\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n  recipient {\n    address\n    id\n  }\n  side\n  openedAt\n  closedAt\n  perUnitPrice {\n    unit\n  }\n  payment {\n    asset {\n      ...ConfirmationItem_payment_asset\n      id\n    }\n    id\n  }\n  dutchAuctionFinalPrice {\n    unit\n  }\n  englishAuctionReservePrice {\n    unit\n  }\n  isCounterOrder\n}\n\nfragment PaymentAssetApprovalAction_data on PaymentAssetApprovalActionType {\n  __typename\n  method {\n    __typename\n    ... on TransactionSubmissionDataType {\n      chain {\n        identifier\n      }\n    }\n  }\n  asset {\n    symbol\n    id\n  }\n  ...useHandleBlockchainActions_approve_payment_asset\n}\n\nfragment PriceTag_paymentAsset on AssetType {\n  assetContract {\n    chain\n    id\n  }\n  symbol\n  imageUrl\n}\n\nfragment WaitForBalanceAction_data on WaitForBalanceActionType {\n  __typename\n}\n\nfragment useHandleBlockchainActions_approve_asset on AssetApprovalActionType {\n  method {\n    __typename\n    ...useHandleBlockchainActions_transaction_method\n  }\n}\n\nfragment useHandleBlockchainActions_approve_payment_asset on PaymentAssetApprovalActionType {\n  method {\n    __typename\n    ...useHandleBlockchainActions_transaction_method\n  }\n}\n\nfragment useHandleBlockchainActions_ask_for_asset_swap on AskForSwapType {\n  fromAsset {\n    decimals\n    relayId\n    id\n  }\n  toAsset {\n    relayId\n    id\n  }\n}\n\nfragment useHandleBlockchainActions_cancel_orders on CancelOrderActionType {\n  method {\n    __typename\n    ... on TransactionSubmissionDataType {\n      ...useTransaction_transaction\n    }\n    ... on SignAndPostOrderCancelType {\n      cancelOrderData: data {\n        payload\n        message\n      }\n      serverSignature\n      clientSignatureStandard\n    }\n  }\n}\n\nfragment useHandleBlockchainActions_create_order on CreateOrderActionType {\n  method {\n    clientMessage\n    clientSignatureStandard\n    serverSignature\n    orderData\n    chain {\n      identifier\n    }\n  }\n}\n\nfragment useHandleBlockchainActions_freeze_asset_metadata on AssetFreezeMetadataActionType {\n  method {\n    __typename\n    ...useHandleBlockchainActions_transaction_method\n  }\n}\n\nfragment useHandleBlockchainActions_fulfill_order on FulfillOrderActionType {\n  method {\n    __typename\n    ...useHandleBlockchainActions_transaction_method\n  }\n}\n\nfragment useHandleBlockchainActions_mint_asset on MintActionType {\n  method {\n    ...useHandleBlockchainActions_transaction_method\n  }\n}\n\nfragment useHandleBlockchainActions_swap_asset on AssetSwapActionType {\n  method {\n    ...useHandleBlockchainActions_transaction_method\n  }\n}\n\nfragment useHandleBlockchainActions_transaction_method on TransactionMethodType {\n  __isTransactionMethodType: __typename\n  __typename\n  ... on TransactionSubmissionDataType {\n    ...useTransaction_transaction\n  }\n  ... on MetaTransactionDataType {\n    ...useTransaction_meta_transaction\n  }\n}\n\nfragment useHandleBlockchainActions_transfer_asset on AssetTransferActionType {\n  method {\n    __typename\n    ...useHandleBlockchainActions_transaction_method\n  }\n}\n\nfragment useTransaction_meta_transaction on MetaTransactionDataType {\n  clientMessage\n  clientSignatureStandard\n  functionSignature\n  verifyingContract\n}\n\nfragment useTransaction_transaction on TransactionSubmissionDataType {\n  chainIdentifier\n  source {\n    value\n  }\n  destination {\n    value\n  }\n  value\n  data\n}\n",
        variables: {
            assetContract: {
                contractAddress: contractAddress,
                chain: process.env.NETWORK === 'goerli' ? "GOERLI" : "ETHEREUM"
            },
            price: {
                paymentAsset: process.env.NETWORK === 'goerli' ? "UGF5bWVudEFzc2V0VHlwZTo0NA==" : "UGF5bWVudEFzc2V0VHlwZTo3OQ==",
                amount: price
            },
            closedAt: new Date(Math.round(Date.now() + days * 1000 * 60 * 60 * 24)).toISOString(),
            collection: slug,
            trait: trait
        },
    };
    const response = await gotScraping({
        url: `https://${process.env.NETWORK === 'goerli' ? "testnets." : ""}opensea.io/__api/graphql/`,
        body: JSON.stringify(createCollectionOfferActionModalQuery),
        method: 'POST',
        headers: {
            "content-type": "application/json",
            "x-signed-query": "bd4dfba8f80ce398f7d488a24dff19414e164c36f5ebfa5099701405d7f4ea02",
            "x-viewer-address": smartAddress,
        }
    });
    if (response.statusCode != 200) {
        return JSON.parse(response.body);
    }
    const data = JSON.parse(response.body);
    if (data.errors) {
        return data;
    }
    const createCollectionOfferActions = data.data.blockchain.createCollectionOfferActions;
    const method = createCollectionOfferActions.length > 1 ? createCollectionOfferActions[1].method : createCollectionOfferActions[0].method;
    // const eip712Hash = TypedDataUtils.eip712Hash(JSON.parse(method.clientMessage), SignTypedDataVersion.V4);
    // const digest = eip712Hash.toString("hex");
    const clientSignature = await kmsSigner.signDigest({
        customData: {
            signType: SignType[SignType.OS_BID],
        },
        data: method.clientMessage,
    });
    if (!clientSignature) {
        return {
            errors: "Sign error"
        }
    }
    return {
        clientSignature: clientSignature,
        orderData: method.orderData,
        serverSignature: method.serverSignature
    }
};

export const postCreateCollectionOffer = async (preData) => {
    const useHandleBlockchainActionsCreateOrderMutation = {
        id: "useHandleBlockchainActionsCreateOrderMutation",
        query: "mutation useHandleBlockchainActionsCreateOrderMutation(\n  $orderData: JSONString!\n  $clientSignature: String!\n  $serverSignature: String!\n) {\n  orders {\n    create(orderData: $orderData, clientSignature: $clientSignature, serverSignature: $serverSignature) {\n      counterOrder {\n        relayId\n        id\n      }\n      order {\n        relayId\n        item {\n          __typename\n          name\n          ... on AssetBundleType {\n            ...bundle_url\n          }\n          ... on Node {\n            __isNode: __typename\n            id\n          }\n        }\n        id\n      }\n      transaction {\n        blockExplorerLink\n        chain {\n          identifier\n        }\n        transactionHash\n        id\n      }\n    }\n  }\n}\n\nfragment bundle_url on AssetBundleType {\n  slug\n  chain {\n    identifier\n  }\n}\n",
        variables: preData
    };
    const response = await gotScraping({
        url: `https://${process.env.NETWORK === 'goerli' ? "testnets." : ""}opensea.io/__api/graphql/`,
        body: JSON.stringify(useHandleBlockchainActionsCreateOrderMutation),
        method: 'POST',
        headers: {
            "content-type": "application/json",
            "x-signed-query": "7a636c506dff8e9ca92165555c42d3902c94b43de611d160991d8f2a123aa886",
        }
    });
    if (response.statusCode != 200) {
        return JSON.parse(response.body);
    }
    return JSON.parse(response.body);
}

export const queryCollectionOfferMultiModalBase = async (slug) => {
    await limiterQueue.removeTokens(1);
    const collectionOfferMultiModalBaseQuery = {
        id: "CollectionOfferMultiModalBaseQuery",
        query: "query CollectionOfferMultiModalBaseQuery(\n  $collection: CollectionSlug!\n  $chain: ChainScalar!\n) {\n  collection(collection: $collection) {\n    slug\n    verificationStatus\n    ...OfferModal_collectionData\n    id\n  }\n  tradeLimits(chain: $chain) {\n    ...OfferModal_tradeLimits\n  }\n}\n\nfragment OfferModal_collectionData on CollectionType {\n  isTraitOffersEnabled\n  name\n  slug\n  relayId\n  statsV2 {\n    floorPrice {\n      usd\n      symbol\n    }\n  }\n  ...useOfferModalAdapter_collection\n}\n\nfragment OfferModal_tradeLimits on TradeLimitsType {\n  minimumBidUsdPrice\n  ...useOfferModalAdapter_tradeLimits\n}\n\nfragment useOfferModalAdapter_collection on CollectionType {\n  relayId\n  slug\n  paymentAssets {\n    relayId\n    symbol\n    chain {\n      identifier\n    }\n    asset {\n      usdSpotPrice\n      decimals\n      id\n    }\n    isNative\n    ...utils_PaymentAssetOption\n    id\n  }\n  representativeAsset {\n    assetContract {\n      address\n      chain\n      id\n    }\n    id\n  }\n  assetContracts(first: 2) {\n    edges {\n      node {\n        address\n        chain\n        id\n      }\n    }\n  }\n}\n\nfragment useOfferModalAdapter_tradeLimits on TradeLimitsType {\n  minimumBidUsdPrice\n}\n\nfragment utils_PaymentAssetOption on PaymentAssetType {\n  relayId\n  symbol\n  asset {\n    relayId\n    displayImageUrl\n    usdSpotPrice\n    decimals\n    id\n  }\n}\n",
        variables: {
            chain: process.env.NETWORK === 'goerli' ? "GOERLI" : "ETHEREUM",
            collection: slug
        }
    };
    const response = await gotScraping({
        url: `https://${process.env.NETWORK === 'goerli' ? "testnets." : ""}opensea.io/__api/graphql/`,
        body: JSON.stringify(collectionOfferMultiModalBaseQuery),
        method: 'POST',
        headers: {
            "content-type": "application/json",
            "x-signed-query": "be6d987c1b4dc0f257a3f20eac0e0e92cfcc3a6c775a56a7f8a68b4b0053332f",
        }
    });
    if (response.statusCode != 200) {
        return false;
    }
    const collection = JSON.parse(response.body).data.collection;
    if (collection) {
        return collection.isTraitOffersEnabled;
    }
    return false;
};