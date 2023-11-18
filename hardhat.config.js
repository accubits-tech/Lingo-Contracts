require('dotenv').config();
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
require('@nomicfoundation/hardhat-chai-matchers');
require('@nomicfoundation/hardhat-network-helpers');

const { RPC_URL, POLYGONSCAN_KEY, MNEMONIC } = process.env;

module.exports = {
  networks: {
    // polygon: {
    //   url: RPC_URL,
    //   accounts: { mnemonic: MNEMONIC },
    //   chainId: 137,
    // },
    // mumbai: {
    //   url: RPC_URL,
    //   accounts: { mnemonic: MNEMONIC },
    //   chainId: 80001,
    // },
  },
  solidity: {
    version: '0.8.18',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  etherscan: {
    apiKey: POLYGONSCAN_KEY,
  },
};
