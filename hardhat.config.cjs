require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

const CROSSFI_TESTNET_RPC = process.env.CROSSFI_TESTNET_RPC || "https://rpc.testnet.ms";
const CROSSFI_MAINNET_RPC = process.env.CROSSFI_MAINNET_RPC || "https://rpc.mainnet.ms";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";

module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      viaIR: true, 
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    crossfi_testnet: {
      url: CROSSFI_TESTNET_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 4157,
      gasPrice: 10000000000,
    },
    crossfi_mainnet: {
      url: CROSSFI_MAINNET_RPC,
      accounts: [PRIVATE_KEY],
      chainId: 4158,
      gasPrice: 1_000_000_000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.CROSSFI_API_KEY,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
};