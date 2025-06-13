import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { etherlinkTestnet } from "viem/chains";
// import { EvmPriceServiceConnection } from "@pythnetwork/hermes-client"; // This seems to be outdated in the tutorial?
import { HermesClient, PriceUpdate } from "@pythnetwork/hermes-client";
import { getContract } from "viem";

export const abi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_pyth",
        type: "address",
        internalType: "address",
      },
      {
        name: "_ethUsdPriceId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "mint",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "updateAndMint",
    inputs: [
      {
        name: "pythPriceUpdate",
        type: "bytes[]",
        internalType: "bytes[]",
      },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "error",
    name: "InsufficientFee",
    inputs: [],
  },
] as const;

const ETH_USD_ID = "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" as string;
const XTZ_USD_ID = "0x0affd4b8ad136a21d79bc82450a325ee12ff55a235abc242666e423b8bcffd03" as string;

async function run() {
  const account = privateKeyToAccount(`0x${process.env["PRIVATE_KEY"] as any}`);
  const client = createWalletClient({
    account,
    chain: etherlinkTestnet,
    transport: http(),
  });

  const contract = getContract({
    // address: process.env["DEPLOYMENT_ADDRESS"] as any,
    address: "0xC0Ca860A6BF62468b8ec0b742A672802a43D795b" as any, // Contract I deployed to Etherlink testnet
    abi: abi,
    client,
  });

  const connection = new HermesClient("https://hermes.pyth.network");
  // const priceIds = [process.env["ETH_USD_ID"] as string];
  // const priceIds = [ETH_USD_ID];
  const priceIds = [XTZ_USD_ID];
  const priceFeedUpdateData = await connection.getLatestPriceUpdates(priceIds);
  console.log("Retrieved Pyth price update:");
  console.log(priceFeedUpdateData);

  const hash = await contract.write.updateAndMint(
    [[`0x${priceFeedUpdateData.binary.data[0]}`]] as any,
    { value: parseEther("5"),gas: 30000000n },
  );
  console.log("Transaction hash:");
  console.log(hash);
}

run();

const getPrice = async () => {
  const connection = new HermesClient("https://hermes.pyth.network");
  const priceIds = [XTZ_USD_ID];
  const priceFeedUpdateData = await connection.getLatestPriceUpdates(priceIds) as PriceUpdate;
  console.log("Retrieved Pyth price update:");
  const parsedPrice = priceFeedUpdateData.parsed![0].price;
  console.log(parsedPrice);
  const actualPrice = parseInt(parsedPrice.price) * (10 ** parsedPrice.expo);
  console.log ("One XTZ is worth ", actualPrice, "USD");
  const oneUSD = Math.ceil((1/actualPrice) * 100) / 100; // Round up to two decimals
  console.log("So you need", oneUSD, "XTZ");
}

// getPrice();
