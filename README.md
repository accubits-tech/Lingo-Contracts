## Lingo Smart Contracts

### Token Contract

This is a solidity language, ERC-20 standard token. Ownership management,Minting and Burning is available. It also have additional features such as Internal Whitelist, External Whitelist and Transaction Fee.

### Distribution Contract

This is a solidity language, ERC20 staking contract. Rewards are calculated according to the amount staked and time period. Users can deposit, withdraw and claim their rewards. Admin can
claim unclaimed tokens after an expiry time. A fees is debited on withdrawal.

## Tools and Framework

### Git

Git is software for tracking changes in any set of files, usually used for coordinating work among programmers collaboratively developing source code during software development. Its goals include speed, data integrity, and support for distributed, non-linear workflows.

### Hardhat

Hardhat is a world-class development environment, testing framework and asset pipeline for blockchains using the Ethereum Virtual Machine (EVM), aiming to make life as a developer easier. We use hardhat in this project to compile and deploy the Lingo contracts in specified network

## Prerequisite

### Install Git

Run below commands

```bash
    sudo apt install git-all
```

### Install NodeJS

Run below commands

```bash
    curl -fsSL https://deb.nodesource.com/setup_lts.x |sudo -E bash -
    sudo apt-get install -y nodejs
```

### Install hardhat

Run below commands

```bash
    sudo npm install hardhat -g
```

## Versions used

- Ubuntu - 22.04.2 LTS
- Git - 2.34.1
- NodeJs - v16.14.2
- Node Package Manager(NPM) - 8.5.0
- Hardhat - 2.13.0
- Solidity - 0.8.19

## Initial Setup

1. Clone Lingo Project Repo from `https://gitlab.com/coinfactory/lingo-token`
2. Open Terminal in the Contract project folder and run `npm install` to install the dependencies.

## Contract Testing (optional)

1. Open Terminal in the Lingo project folder.
2. Run `npx hardhat compile` or `hh compile` or `npm run compile` to compile the contracts
3. Run `npx hardhat test` or `hh test` or `npm run test` to run the Contract test cases
4. Test report will be generated in both JSON and HTML formats
   `./mochawesome-report/Lingo-Token-Test-Report.json`

   `./mochawesome-report/Lingo-Token-Test-Report.html`

## Configurations

### Environment variables

In order to compile and deploy the contract, there are certain values to be set in environment variable. Make a copy of `sample.env` and rename it as `.env` or create a new `.env` file and put :

1. **POLYGONSCAN_KEY** If you work on polygon and want to verify contract on polygon network.
2. **RPC_URL** Polygon or specified network rpc url along with API_KEY.
3. **MNEMONIC** To use known addresses.
4. **TOKEN_NAME** Name of token.
5. **TOKEN_SYMBOL** Symbol of token.
6. **TOKEN_SUPPLY** Total initial supply.
7. **OWNER** Owner wallet address.
8. **TREASURY_WALLET** Where fees are collected.
9. **TXN_FEE_PERCENTAGE** Transaction fee in basis points (10000 = 100%).
10. **SLOT** Time period of one distribution period in hours.
11. **ADMIN_CLAIM_PERIOD** Reward expiration time in hours.
12. **WITHDRAWAL_FEE_PERCENTAGE** Withdrawal fee in basis points (10000 = 100%).

## Deployment

1. Make sure contract contract configurations are correct
2. Set the environment variables as required
3. Deploy contract with below commands

   `hh run scripts/deploy.js --network network_name`

   where network_name = polygon, mumbai etc.

### Verifying Contract (hardhat-etherscan)

A Hardhat plugin that can be used to automatically verify your contracts through the Etherscan API. With this plugin you can verify your contracts with just a simple command:

`hh verify --network network_name deployed_contract_address `
