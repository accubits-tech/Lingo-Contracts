const { describe } = require('mocha');
const { expect } = require('chai');
const { ethers } = require('hardhat');
const _ = require('lodash');

const {
  debitFee,
  deposit,
  distribute,
  skipTime,
  initialFundAllocation,
  forecastCredits,
  reset,
  withdraw,
  debitWithdrawalFee,
} = require('./utils');

const BN = ethers.BigNumber.from;

const {
  NAME,
  SYMBOL,
  TOTAL_SUPPLY,
  DECIMALS,
  FEE,
  ZERO_ADDRESS,
  SLOT,
  ADMIN_CLAIM_PERIOD,
  WITHDRAWAL_FEE,
} = require('./config/index.js');
const creditsForDuration = require('./utils/creditsForDuration');
const userClaim = require('./utils/userClaim');

const operation = { withdraw: 0, deposit: 1 };

describe('Distribution Contract', () => {
  let owner, user1, user2, user3, treasuryWallet;
    let token;
    let distributionContract;
    const TOTAL_SUPPLY_BN = BN(TOTAL_SUPPLY);
    const DECIMALS_BN = BN(DECIMALS);
    const FEE_BN = BN(FEE);
    const SLOT_BN = BN(SLOT);
    const ADMIN_CLAIM_PERIOD_BN = BN(ADMIN_CLAIM_PERIOD);
    const WITHDRAWAL_FEE_BN = BN(WITHDRAWAL_FEE);

    beforeEach(async () => {
      await reset();
  
      [owner, user1, user2, user3, treasuryWallet] = await ethers.getSigners();
  
      const Token = await ethers.getContractFactory('LINGO');
      const Distribution = await ethers.getContractFactory('Distribution');
  
      token = await Token.deploy(
        NAME,
        SYMBOL,
        TOTAL_SUPPLY_BN,
        owner.address,
        treasuryWallet.address,
        FEE_BN
      );
  
      distributionContract = await Distribution.deploy(
        owner.address,
        treasuryWallet.address,
        token.address,
        SLOT_BN,
        ADMIN_CLAIM_PERIOD_BN,
        WITHDRAWAL_FEE_BN
      );
    });

  describe('With whitelisting', () => {

    beforeEach(async () => {
      token.addToWhiteList(0, [distributionContract.address]);
    });
  
    describe('Deployment', async () => {
      it('Ownership transferred from deployer to owner', async () => {
        const result = await distributionContract.owner();
        expect(result).to.equal(owner.address);
      });
  
      it('Distribution Contract is externally whitelisted', async () => {
        expect(await token.isExternalWhiteListed(distributionContract.address)).to.be.true;
      });
    });
  
    describe('Withdrawal Fee', () => {
      it('Anyone can read current fee percentage', async () => {
        expect((await distributionContract.getWithdrawalFee()).eq(WITHDRAWAL_FEE_BN)).is.true;
      });
  
      it('Owner can update fee percentage', async () => {
        expect((await distributionContract.getWithdrawalFee()).eq(WITHDRAWAL_FEE_BN)).is.true;
  
        const NEW_FEE = BN(200);
        await distributionContract.setWithdrawalFee(NEW_FEE);
  
        expect((await distributionContract.getWithdrawalFee()).eq(NEW_FEE)).is.true;
      });
  
      it('Event emitted when fee percentage updated', async () => {
        const NEW_FEE = BN(200);
        await expect(distributionContract.setWithdrawalFee(NEW_FEE))
          .to.emit(distributionContract, 'WithdrawalFeeUpdated')
          .withArgs(NEW_FEE);
      });
  
      it('Reverts when non owner tries to update fee percentage', async () => {
        const NEW_FEE = BN(200);
  
        await expect(
          distributionContract.connect(user1).setWithdrawalFee(NEW_FEE)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
  
      it('Reverts when tries to update fee percentage outside the limit 0% - 5%', async () => {
        const NEW_FEE = BN(600);
  
        await expect(distributionContract.setWithdrawalFee(NEW_FEE)).to.be.revertedWith(
          'LINGO: Withdrawal Fee should be between 0% - 5%'
        );
      });
    });
  
    describe('Treasury Wallet', () => {
      it('Any one can read current treasury wallet', async () => {
        expect(await distributionContract.connect(user1).getTreasuryWalletAddress()).equals(
          treasuryWallet.address
        );
      });
  
      it('Owner can update treasury wallet', async () => {
        await distributionContract.setTreasuryWalletAddress(user3.address);
        expect(await distributionContract.getTreasuryWalletAddress()).equals(user3.address);
      });
  
      it('Event emitted when treasury wallet updated', async () => {
        await expect(distributionContract.setTreasuryWalletAddress(user3.address))
          .to.emit(distributionContract, 'TreasuryWalletUpdated')
          .withArgs(user3.address);
      });
  
      it('Reverts when non owner tries to update treasury wallet', async () => {
        await expect(
          distributionContract.connect(user1).setTreasuryWalletAddress(user3.address)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
  
      it('Reverts when owner tries to update treasury wallet with zero address', async () => {
        await expect(distributionContract.setTreasuryWalletAddress(ZERO_ADDRESS)).to.be.revertedWith(
          'LINGO: Zero Address'
        );
      });
    });
  
    describe('Slot', () => {
      it('Anyone can read current slot', async () => {
        expect((await distributionContract.getSlot()).eq(SLOT_BN)).is.true;
      });
  
      it('Owner can update slot', async () => {
        expect((await distributionContract.getSlot()).eq(SLOT_BN)).is.true;
  
        const NEW_SLOT = BN(10 * 24);
        await distributionContract.updateSlot(NEW_SLOT);
  
        expect((await distributionContract.getSlot()).eq(NEW_SLOT)).is.true;
      });
  
      it('Event emitted when slot updated', async () => {
        const NEW_SLOT = BN(10 * 24);
  
        await expect(distributionContract.updateSlot(NEW_SLOT))
          .to.emit(distributionContract, 'SlotUpdated')
          .withArgs(NEW_SLOT);
      });
  
      it('Reverts when non owner tries to update slot', async () => {
        const NEW_SLOT = BN(10 * 24);
  
        await expect(distributionContract.connect(user1).updateSlot(NEW_SLOT)).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
  
      it('Reverts when tries to update slot with zero', async () => {
        const NEW_SLOT = BN(0);
  
        await expect(distributionContract.updateSlot(NEW_SLOT)).to.be.revertedWith(
          'LINGO: Slot cannot be zero'
        );
      });
    });
  
    describe('Admin Claim Period', () => {
      it('Anyone can read admin claim period', async () => {
        expect((await distributionContract.getAdminClaimPeriod()).eq(ADMIN_CLAIM_PERIOD_BN)).is.true;
      });
  
      it('Owner can update admin claim period', async () => {
        expect((await distributionContract.getAdminClaimPeriod()).eq(ADMIN_CLAIM_PERIOD_BN)).is.true;
  
        const NEW_PERIOD = BN(6 * 30 * 24);
        await distributionContract.updateAdminClaimPeriod(NEW_PERIOD);
  
        expect((await distributionContract.getAdminClaimPeriod()).eq(NEW_PERIOD)).is.true;
      });
  
      it('Event emitted when slot updated', async () => {
        const NEW_PERIOD = BN(6 * 30 * 24);
  
        await expect(distributionContract.updateAdminClaimPeriod(NEW_PERIOD))
          .to.emit(distributionContract, 'AdminClaimPeriodUpdated')
          .withArgs(NEW_PERIOD);
      });
  
      it('Reverts when non owner tries to update slot', async () => {
        const NEW_PERIOD = BN(6 * 30 * 24);
  
        await expect(
          distributionContract.connect(user1).updateAdminClaimPeriod(NEW_PERIOD)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });
  
    describe('Contract Current State', () => {
      it('Anyone can read current token address', async () => {
        expect(await distributionContract.getTokenAddress()).equal(token.address);
      });
  
      it('Anyone can read current contract state', async () => {
        const state = await distributionContract.getContractState();
        const currentEpochTimeInHoursBN = BN(Math.floor(Date.now() / 1000 / 3600));
  
        expect(state.startTime.eq(currentEpochTimeInHoursBN)).is.true;
        expect(state.endTime.eq(currentEpochTimeInHoursBN.add(SLOT_BN))).is.true;
        expect(state.totalAmount.eq(BN(0))).is.true;
        expect(state.totalCredits.eq(BN(0))).is.true;
      });
  
      it('Anyone can read staked user address', async () => {
        const balanceBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        await initialFundAllocation(token, balanceBN);
        await deposit(distributionContract, token, user1, amountBN);
        await deposit(distributionContract, token, user2, amountBN);
        await deposit(distributionContract, token, user3, amountBN);
  
        const stakedUsers = await distributionContract.getUserAddresses();
  
        expect(_.isEqual(stakedUsers, [user1.address, user2.address, user3.address])).is.true;
      });
  
      it('Anyone can read current user status', async () => {
        const balanceBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        await initialFundAllocation(token, balanceBN);
        await deposit(distributionContract, token, user1, amountBN);
  
        const userStatus = await distributionContract.getUserStatus(user1.address);
        const currentEpochTimeInHoursBN = BN(Math.floor(Date.now() / 1000 / 3600));
  
        expect(userStatus.balance.eq(amountBN)).is.true;
        expect(userStatus.forecastedCredits.eq(amountBN.mul(SLOT_BN))).is.true;
        expect(userStatus.lastUpdatedTimestamp.eq(currentEpochTimeInHoursBN)).is.true;
        expect(userStatus.lastClaimedTimestamp.eq(currentEpochTimeInHoursBN)).is.true;
      });
  
      it('Anyone can read distribution history', async () => {
        const balanceBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        await initialFundAllocation(token, balanceBN);
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
        await distribute(distributionContract, token, amountBN);
  
        const currentEpochTimeInHoursBN = BN(Math.floor(Date.now() / 1000 / 3600));
        const distributionHistory = await distributionContract.getDistributionHistory();
  
        expect(distributionHistory.length > 0).is.true;
        expect(distributionHistory[0].startTime.eq(currentEpochTimeInHoursBN)).is.true;
        expect(distributionHistory[0].endTime.eq(currentEpochTimeInHoursBN.add(SLOT_BN))).is.true;
        expect(distributionHistory[0].monthlyProfit.eq(amountBN)).is.true;
        expect(distributionHistory[0].totalCredits.eq(BN(0))).is.true;
        expect(distributionHistory[0].remainingTokensToClaim.eq(amountBN)).is.true;
      });
    });
  
    describe('Deposit', () => {
      beforeEach(async () => {
        const balanceBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        await initialFundAllocation(token, balanceBN);
      });
  
      it('Any user with enough token balance can deposit any amount of tokens to the contract ', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        const balance = await token.balanceOf(user1.address);
  
        await deposit(distributionContract, token, user1, amountBN);
  
        const userStatus = await distributionContract.getUserStatus(user1.address);
        const currentEpochTimeInHoursBN = BN(Math.floor(Date.now() / 1000 / 3600));
  
        expect((await token.balanceOf(user1.address)).eq(balance.sub(amountBN))).is.true;
        expect(userStatus.balance.eq(amountBN)).is.true;
        expect(userStatus.forecastedCredits.eq(amountBN.mul(SLOT_BN))).is.true;
        expect(userStatus.lastUpdatedTimestamp.eq(currentEpochTimeInHoursBN)).is.true;
        expect(userStatus.lastClaimedTimestamp.eq(currentEpochTimeInHoursBN)).is.true;
      });
  
      it('Multiple users can deposit ', async () => {
        const currentEpochTimeInHoursBN = BN(Math.floor(Date.now() / 1000 / 3600));
  
        const amountBN1 = BN(100).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(50).mul(BN(10).pow(DECIMALS_BN));
  
        let user1Status = await distributionContract.getUserStatus(user1.address);
        let user2Status = await distributionContract.getUserStatus(user2.address);
  
        const expectedCredits1 = await forecastCredits(
          distributionContract,
          user1Status,
          amountBN1,
          currentEpochTimeInHoursBN,
          operation.deposit
        );
        const expectedCredits2 = await forecastCredits(
          distributionContract,
          user2Status,
          amountBN2,
          currentEpochTimeInHoursBN,
          operation.deposit
        );
  
        await deposit(distributionContract, token, user1, amountBN1);
        await deposit(distributionContract, token, user2, amountBN2);
  
        user1Status = await distributionContract.getUserStatus(user1.address);
        user2Status = await distributionContract.getUserStatus(user2.address);
  
        expect(user1Status.balance.eq(amountBN1)).is.true;
        expect(user1Status.forecastedCredits.eq(expectedCredits1)).is.true;
        expect(user2Status.balance.eq(amountBN2)).is.true;
        expect(user2Status.forecastedCredits.eq(expectedCredits2)).is.true;
      });
  
      it('On deposit contract state changes ', async () => {
        const amountBN1 = BN(100).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(50).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN1);
        await deposit(distributionContract, token, user2, amountBN2);
  
        const user1Status = await distributionContract.getUserStatus(user1.address);
        const user2Status = await distributionContract.getUserStatus(user2.address);
  
        expect(user1Status.balance.eq(amountBN1)).is.true;
        expect(user1Status.forecastedCredits.eq(amountBN1.mul(SLOT_BN))).is.true;
        expect(user2Status.balance.eq(amountBN2)).is.true;
        expect(user2Status.forecastedCredits.eq(amountBN2.mul(SLOT_BN))).is.true;
  
        const contractState = await distributionContract.getContractState();
  
        expect(contractState.totalAmount.eq(amountBN1.add(amountBN2))).is.true;
        expect(
          contractState.totalCredits.eq(
            user1Status.forecastedCredits.add(user2Status.forecastedCredits)
          )
        ).is.true;
      });
  
      it('Users can deposit any amount at any time ', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN);
  
        const currentEpochTimeInHoursBN = BN(Math.floor(Date.now() / 1000 / 3600));
        const userStatus = await distributionContract.getUserStatus(user1.address);
  
        expect(userStatus.balance.eq(amountBN)).is.true;
        expect(userStatus.forecastedCredits.eq(amountBN.mul(SLOT_BN))).is.true;
        expect(userStatus.lastUpdatedTimestamp.eq(currentEpochTimeInHoursBN)).is.true;
        expect(userStatus.lastClaimedTimestamp.eq(currentEpochTimeInHoursBN)).is.true;
  
        const skippingTime = BN(10 * 24).mul(BN(3600));
        const amountBN2 = BN(50).mul(BN(10).pow(DECIMALS_BN));
        const epochTimeInHoursBN = BN(Math.floor(Date.now() / 1000 / 3600)).add(BN(10 * 24));
        const expectedCredits = await forecastCredits(
          distributionContract,
          userStatus,
          amountBN2,
          epochTimeInHoursBN,
          operation.deposit
        );
  
        await skipTime(skippingTime.toNumber());
        await deposit(distributionContract, token, user1, amountBN2);
        const userStatus2 = await distributionContract.getUserStatus(user1.address);
  
        expect(userStatus2.balance.eq(amountBN.add(amountBN2))).is.true;
        expect(userStatus2.forecastedCredits.eq(expectedCredits)).is.true;
        expect(userStatus2.lastUpdatedTimestamp.eq(epochTimeInHoursBN)).is.true;
        expect(userStatus2.lastClaimedTimestamp.eq(currentEpochTimeInHoursBN)).is.true;
      });
  
      it('Event emitted when fund deposited', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        await token.connect(user1).approve(distributionContract.address, amountBN);
  
        await expect(distributionContract.connect(user1).deposit(amountBN))
          .to.emit(distributionContract, 'Deposit')
          .withArgs(user1.address, amountBN);
      });
  
      it('Add user to the staked users list', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        const initialList = await distributionContract.getUserAddresses();
  
        expect(_.isEqual(initialList, [user1.address])).is.false;
  
        await deposit(distributionContract, token, user1, amountBN);
  
        const finalList = await distributionContract.getUserAddresses();
  
        expect(_.isEqual(finalList, [user1.address])).is.true;
      });
  
      it('Reverts when tries to deposit zero amount', async () => {
        const amountBN = BN(0);
        await expect(distributionContract.connect(user1).deposit(amountBN)).to.be.revertedWith(
          'LINGO: Amount cannot be zero'
        );
      });
  
      it('Reverts when tries to deposit without allowance', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        await expect(distributionContract.connect(user1).deposit(amountBN)).to.be.revertedWith(
          'LINGO: Insufficient allowance'
        );
      });
  
      it('Reverts when staking is not active', async () => {
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        await expect(distributionContract.connect(user1).deposit(amountBN)).to.be.revertedWith(
          'LINGO: Distribution is on hold. Please contact admin'
        );
      });
  
      it('Reverts when user have unclaimed tokens', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await token.connect(user1).approve(distributionContract.address, amountBN);
        await distributionContract.connect(user1).deposit(amountBN)
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
        const distributionAmountBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributionAmountBN);
  
        await expect(distributionContract.connect(user1).deposit(amountBN)).to.be.revertedWith(
          'LINGO: User have unclaimed tokens. Please claim it before deposit or withdraw'
        );
      });
  
      it('Able to deposit after the slot even with zero credits and have deposit withdraw history', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        // First attempt
        await deposit(distributionContract, token, user1, amountBN);
        await skipTime(BN(60).toNumber());
        await withdraw(distributionContract, user1, amountBN);

        // Second attempt
  
        const user1StatusPreSlotExp = await distributionContract.getUserStatus(user1.address)
        expect(user1StatusPreSlotExp.balance.eq(BN(0))).is.true;
  
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
        const distributionAmountBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributionAmountBN);
  
        await deposit(distributionContract, token, user1, amountBN);
        await skipTime(BN(24 * 60).toNumber());
        await deposit(distributionContract, token, user1, amountBN);

        const user1StatusPostSlotExp = await distributionContract.getUserStatus(user1.address)
  
        expect(user1StatusPostSlotExp.balance.eq(amountBN.mul(BN(2)))).is.true;
      });
    });
  
    describe('Withdraw', () => {
      beforeEach(async () => {
        const balanceBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        await initialFundAllocation(token, balanceBN);
      });
  
      it('Any active user can fully withdraw staked fund', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        const userStatus1 = await distributionContract.getUserStatus(user1.address);
        const currentEpochTimeInHoursBN1 = BN(Math.floor(Date.now() / 1000 / 3600));
  
        expect(userStatus1.balance.eq(amountBN)).is.true;
        expect(userStatus1.forecastedCredits.eq(amountBN.mul(SLOT_BN))).is.true;
        expect(userStatus1.lastUpdatedTimestamp.eq(currentEpochTimeInHoursBN1)).is.true;
        expect(userStatus1.lastClaimedTimestamp.eq(currentEpochTimeInHoursBN1)).is.true;
  
        const balance = await token.balanceOf(user1.address);
  
        await withdraw(distributionContract, user1, amountBN);
  
        const userStatus2 = await distributionContract.getUserStatus(user1.address);
        const currentEpochTimeInHoursBN2 = BN(Math.floor(Date.now() / 1000 / 3600));
        const expectedCredits = await forecastCredits(
          distributionContract,
          userStatus1,
          amountBN,
          currentEpochTimeInHoursBN2,
          0
        );
        const expectedAmount = await debitWithdrawalFee(token, distributionContract, amountBN);
  
        expect((await token.balanceOf(user1.address)).eq(balance.add(expectedAmount))).is.true;
        expect(userStatus2.balance.eq(BN(0))).is.true;
        expect(userStatus2.forecastedCredits.eq(expectedCredits)).is.true;
        expect(userStatus2.lastUpdatedTimestamp.eq(currentEpochTimeInHoursBN2)).is.true;
        expect(userStatus2.lastClaimedTimestamp.eq(currentEpochTimeInHoursBN2)).is.true;
      });
  
      it('Any active user can partially withdraw staked fund', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        const userStatus1 = await distributionContract.getUserStatus(user1.address);
        const currentEpochTimeInHoursBN1 = BN(Math.floor(Date.now() / 1000 / 3600));
  
        expect(userStatus1.balance.eq(amountBN)).is.true;
        expect(userStatus1.forecastedCredits.eq(amountBN.mul(SLOT_BN))).is.true;
        expect(userStatus1.lastUpdatedTimestamp.eq(currentEpochTimeInHoursBN1)).is.true;
        expect(userStatus1.lastClaimedTimestamp.eq(currentEpochTimeInHoursBN1)).is.true;
  
        const balance = await token.balanceOf(user1.address);
  
        const withdrawAmountBN = BN(50).mul(BN(10).pow(DECIMALS_BN));
        await withdraw(distributionContract, user1, withdrawAmountBN);
  
        const userStatus2 = await distributionContract.getUserStatus(user1.address);
        const currentEpochTimeInHoursBN2 = BN(Math.floor(Date.now() / 1000 / 3600));
        const expectedCredits = await forecastCredits(
          distributionContract,
          userStatus1,
          withdrawAmountBN,
          currentEpochTimeInHoursBN2,
          0
        );
        const expectedAmount = await debitWithdrawalFee(
          token,
          distributionContract,
          withdrawAmountBN
        );
  
        expect((await token.balanceOf(user1.address)).eq(balance.add(expectedAmount))).is.true;
        expect(userStatus2.balance.eq(amountBN.sub(withdrawAmountBN))).is.true;
        expect(userStatus2.forecastedCredits.eq(expectedCredits)).is.true;
        expect(userStatus2.lastUpdatedTimestamp.eq(currentEpochTimeInHoursBN2)).is.true;
        expect(userStatus2.lastClaimedTimestamp.eq(currentEpochTimeInHoursBN2)).is.true;
      });
  
      it('Multiple users can withdraw ', async () => {
        const amountBN1 = BN(100).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(50).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN1);
        await deposit(distributionContract, token, user2, amountBN2);
  
        const user1Status1 = await distributionContract.getUserStatus(user1.address);
        const user2Status1 = await distributionContract.getUserStatus(user2.address);
  
        const withdrawAmountBN1 = BN(70).mul(BN(10).pow(DECIMALS_BN));
        const withdrawAmountBN2 = BN(30).mul(BN(10).pow(DECIMALS_BN));
  
        await withdraw(distributionContract, user1, withdrawAmountBN1);
        await withdraw(distributionContract, user2, withdrawAmountBN2);
  
        const user1Status2 = await distributionContract.getUserStatus(user1.address);
        const user2Status2 = await distributionContract.getUserStatus(user2.address);
  
        const currentEpochTimeInHoursBN2 = BN(Math.floor(Date.now() / 1000 / 3600));
        const expectedCredits1 = await forecastCredits(
          distributionContract,
          user1Status1,
          withdrawAmountBN1,
          currentEpochTimeInHoursBN2,
          0
        );
        const expectedCredits2 = await forecastCredits(
          distributionContract,
          user2Status1,
          withdrawAmountBN2,
          currentEpochTimeInHoursBN2,
          0
        );
  
        expect(user1Status2.balance.eq(amountBN1.sub(withdrawAmountBN1))).is.true;
        expect(user1Status2.forecastedCredits.eq(expectedCredits1)).is.true;
        expect(user2Status2.balance.eq(amountBN2.sub(withdrawAmountBN2))).is.true;
        expect(user2Status2.forecastedCredits.eq(expectedCredits2)).is.true;
      });
  
      it('On withdraw contract state changes ', async () => {
        const amountBN1 = BN(100).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(50).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN1);
        await deposit(distributionContract, token, user2, amountBN2);
  
        const user1Status1 = await distributionContract.getUserStatus(user1.address);
        const user2Status1 = await distributionContract.getUserStatus(user2.address);
  
        expect(user1Status1.balance.eq(amountBN1)).is.true;
        expect(user1Status1.forecastedCredits.eq(amountBN1.mul(SLOT_BN))).is.true;
        expect(user2Status1.balance.eq(amountBN2)).is.true;
        expect(user2Status1.forecastedCredits.eq(amountBN2.mul(SLOT_BN))).is.true;
  
        const contractState1 = await distributionContract.getContractState();
  
        expect(contractState1.totalAmount.eq(amountBN1.add(amountBN2))).is.true;
        expect(
          contractState1.totalCredits.eq(
            user1Status1.forecastedCredits.add(user2Status1.forecastedCredits)
          )
        ).is.true;
  
        const withdrawAmountBN1 = BN(70).mul(BN(10).pow(DECIMALS_BN));
        const withdrawAmountBN2 = BN(30).mul(BN(10).pow(DECIMALS_BN));
  
        await withdraw(distributionContract, user1, withdrawAmountBN1);
        await withdraw(distributionContract, user2, withdrawAmountBN2);
  
        const user1Status2 = await distributionContract.getUserStatus(user1.address);
        const user2Status2 = await distributionContract.getUserStatus(user2.address);
        const currentEpochTimeInHoursBN2 = BN(Math.floor(Date.now() / 1000 / 3600));
        const expectedCredits1 = await forecastCredits(
          distributionContract,
          user1Status1,
          withdrawAmountBN1,
          currentEpochTimeInHoursBN2,
          0
        );
        const expectedCredits2 = await forecastCredits(
          distributionContract,
          user2Status1,
          withdrawAmountBN2,
          currentEpochTimeInHoursBN2,
          0
        );
  
        expect(user1Status2.balance.eq(amountBN1.sub(withdrawAmountBN1))).is.true;
        expect(user1Status2.forecastedCredits.eq(expectedCredits1)).is.true;
        expect(user2Status2.balance.eq(amountBN2.sub(withdrawAmountBN2))).is.true;
        expect(user2Status2.forecastedCredits.eq(expectedCredits2)).is.true;
  
        const contractState2 = await distributionContract.getContractState();
  
        expect(contractState2.totalAmount.eq(user1Status2.balance.add(user2Status2.balance))).is
          .true;
        expect(
          contractState2.totalCredits.eq(
            user1Status2.forecastedCredits.add(user2Status2.forecastedCredits)
          )
        ).is.true;
      });
  
      it('Users can withdraw any amount at any time ', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN);
  
        const balance = await token.balanceOf(user1.address);
        const userStatus1 = await distributionContract.getUserStatus(user1.address);
        const currentEpochTimeInHoursBN1 = BN(Math.floor(Date.now() / 1000 / 3600));
        const withdrawAmountBN1 = BN(50).mul(BN(10).pow(DECIMALS_BN));
        const expectedCredits1 = await forecastCredits(
          distributionContract,
          userStatus1,
          withdrawAmountBN1,
          currentEpochTimeInHoursBN1,
          0
        );
        const expectedAmount1 = await debitWithdrawalFee(
          token,
          distributionContract,
          withdrawAmountBN1
        );
  
        await withdraw(distributionContract, user1, withdrawAmountBN1);
        const userStatus2 = await distributionContract.getUserStatus(user1.address);
  
        expect((await token.balanceOf(user1.address)).eq(balance.add(expectedAmount1))).is.true;
        expect(userStatus2.balance.eq(amountBN.sub(withdrawAmountBN1))).is.true;
        expect(userStatus2.forecastedCredits.eq(expectedCredits1)).is.true;
  
        const skippingTime = BN(10 * 24).mul(BN(3600));
        const currentEpochTimeInHoursBN2 = BN(Math.floor(Date.now() / 1000 / 3600)).add(BN(10 * 24));
        const withdrawAmountBN2 = BN(25).mul(BN(10).pow(DECIMALS_BN));
        const expectedCredits2 = await forecastCredits(
          distributionContract,
          userStatus2,
          withdrawAmountBN2,
          currentEpochTimeInHoursBN2,
          0
        );
        const expectedAmount2 = await debitWithdrawalFee(
          token,
          distributionContract,
          withdrawAmountBN2
        );
  
        await skipTime(skippingTime.toNumber());
        await withdraw(distributionContract, user1, withdrawAmountBN2);
  
        const userStatus3 = await distributionContract.getUserStatus(user1.address);
  
        expect(
          (await token.balanceOf(user1.address)).eq(
            balance.add(expectedAmount1).add(expectedAmount2)
          )
        ).is.true;
        expect(userStatus3.balance.eq(userStatus2.balance.sub(withdrawAmountBN2))).is.true;
        expect(userStatus3.forecastedCredits.eq(expectedCredits2)).is.true;
      });
  
      it('Event emitted when fund withdrawn', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        await expect(distributionContract.connect(user1).withdraw(amountBN))
          .to.emit(distributionContract, 'Withdraw')
          .withArgs(user1.address, amountBN);
      });
  
      it('Transaction Fee and Withdrawal Fee debited and transferred to treasury wallet', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        const userBalance = await token.balanceOf(user1.address);
        const treasuryBalance = await token.balanceOf(treasuryWallet.address);
  
        await withdraw(distributionContract, user1, amountBN);
  
        const expectedAmount = await debitWithdrawalFee(token, distributionContract, amountBN);
  
        expect((await token.balanceOf(user1.address)).eq(userBalance.add(expectedAmount))).is.true;
        expect((await token.balanceOf(treasuryWallet.address)).eq(amountBN.sub(expectedAmount))).is
          .true;
      });
  
      it('Reverts when tries to withdraw zero amount', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        await expect(distributionContract.connect(user1).withdraw(BN(0))).to.be.revertedWith(
          'LINGO: Amount cannot be zero'
        );
      });
  
      it('Reverts when tries to withdraw more than staked amount', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
        const withdrawAmountBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
  
        await expect(
          distributionContract.connect(user1).withdraw(withdrawAmountBN)
        ).to.be.revertedWith('LINGO: Insufficient balance');
      });
  
      it('Reverts when an user who have not staked tries to withdraw', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        await expect(distributionContract.connect(user1).withdraw(amountBN)).to.be.revertedWith(
          'LINGO: Not an active user'
        );
      });
  
      it('Reverts when staking is not active', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
  
        await expect(distributionContract.connect(user1).withdraw(amountBN)).to.be.revertedWith(
          'LINGO: Distribution is on hold. Please contact admin'
        );
      });
  
      it('Reverts when user have unclaimed tokens', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
        const distributionAmountBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributionAmountBN);
  
        await expect(distributionContract.connect(user1).withdraw(amountBN)).to.be.revertedWith(
          'LINGO: User have unclaimed tokens. Please claim it before deposit or withdraw'
        );
      });
    });
  
    describe('Distribute', () => {
      beforeEach(async () => {
        const balanceBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        await initialFundAllocation(token, balanceBN);
      });
  
      it('Admin can distribute tokens when each slot ends', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        const contractState = await distributionContract.getContractState();
  
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        const distributionHistory = await distributionContract.getDistributionHistory();
  
        expect(distributionHistory.length > 0).is.true;
        expect(distributionHistory[0].startTime.eq(contractState.startTime)).is.true;
        expect(distributionHistory[0].endTime.eq(contractState.endTime)).is.true;
        expect(distributionHistory[0].monthlyProfit.eq(distributeAmountBN)).is.true;
        expect(distributionHistory[0].totalCredits.eq(contractState.totalCredits)).is.true;
        expect(distributionHistory[0].remainingTokensToClaim.eq(distributeAmountBN)).is.true;
      });
  
      it('New slot is set after distribution function called', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        const { startTime, endTime, totalAmount, totalCredits } =
          await distributionContract.getContractState();
  
        const distributionHistory = await distributionContract.getDistributionHistory();
  
        expect(distributionHistory.length > 0).is.true;
        expect(startTime.eq(distributionHistory[0].endTime)).is.true;
        expect(endTime.eq(distributionHistory[0].endTime.add(SLOT_BN))).is.true;
        expect(totalCredits.eq(totalAmount.mul(endTime.sub(startTime)))).is.true;
      });
  
      it('Event emitted when fund deposited', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await token.approve(distributionContract.address, distributeAmountBN);
  
        await expect(distributionContract.distribute(distributeAmountBN))
          .to.emit(distributionContract, 'Distribute')
          .withArgs(distributeAmountBN);
      });
  
      it('Reverts when non owner tries to call distribute', async () => {
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await token.connect(user1).approve(distributionContract.address, distributeAmountBN);
  
        await expect(
          distributionContract.connect(user1).distribute(distributeAmountBN)
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
  
      it('Reverts when tries to distribute zero amount', async () => {
        await token.approve(distributionContract.address, BN(0));
        await expect(distributionContract.distribute(BN(0))).to.be.revertedWith(
          'LINGO: Amount cannot be zero'
        );
      });
  
      it('Reverts when tries to deposit without allowance', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
        await expect(distributionContract.distribute(amountBN)).to.be.revertedWith(
          'LINGO: Insufficient allowance'
        );
      });
  
      it('Reverts when tries to distribute before ending the slot', async () => {
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await skipTime(
          BN(SLOT_BN.sub(BN(24)))
            .mul(BN(3600))
            .toNumber()
        );
        await token.approve(distributionContract.address, distributeAmountBN);
        await expect(distributionContract.distribute(distributeAmountBN)).to.be.revertedWith(
          'LINGO: Current slot is active'
        );
      });
    });
  
    describe('Claim', () => {
      beforeEach(async () => {
        const balanceBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        await initialFundAllocation(token, balanceBN);
      });
  
      it('Users can claim their rewards when each slot ends', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
        await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        const balance = await token.balanceOf(user1.address);
        await distributionContract.connect(user1).claimRewards();
  
        const expectedAmount = await debitFee(token, distributeAmountBN);
        const finalBalance = await token.balanceOf(user1.address);
        const epochTimeInHoursBN = BN(Math.floor(Date.now() / 1000 / 3600)).add(SLOT_BN.add(BN(1)));
        const userStatus = await distributionContract.getUserStatus(user1.address);
  
        expect(finalBalance.sub(balance).eq(expectedAmount)).is.true;
        expect(userStatus.lastClaimedTimestamp.eq(epochTimeInHoursBN)).is.true;
  
        const distributionHistory = await distributionContract.getDistributionHistory();
        expect(distributionHistory[0].remainingTokensToClaim.eq(BN(0))).is.true;
      });
  
      it('Tokens are distributed among the users according to their staked amount and time period', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
        await deposit(distributionContract, token, user2, amountBN);
  
        await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        const balanceUser1 = await token.balanceOf(user1.address);
        await distributionContract.connect(user1).claimRewards();
  
        const expectedAmount = await debitFee(token, distributeAmountBN.div(2));
        const finalBalanceUser1 = await token.balanceOf(user1.address);
        const epochTimeInHoursBN = BN(Math.floor(Date.now() / 1000 / 3600)).add(SLOT_BN.add(BN(1)));
        const user1Status = await distributionContract.getUserStatus(user1.address);
  
        expect(finalBalanceUser1.sub(balanceUser1).eq(expectedAmount)).is.true;
        expect(user1Status.lastClaimedTimestamp.eq(epochTimeInHoursBN)).is.true;
  
        const distributionHistory1 = await distributionContract.getDistributionHistory();
        expect(distributionHistory1[0].remainingTokensToClaim.eq(distributeAmountBN.div(2))).is.true;
  
        const balanceUser2 = await token.balanceOf(user2.address);
        await distributionContract.connect(user2).claimRewards();
  
        const finalBalanceUser2 = await token.balanceOf(user2.address);
        const user2Status = await distributionContract.getUserStatus(user2.address);
  
        expect(finalBalanceUser2.sub(balanceUser2).eq(expectedAmount)).is.true;
        expect(user2Status.lastClaimedTimestamp.eq(epochTimeInHoursBN)).is.true;
  
        const distributionHistory2 = await distributionContract.getDistributionHistory();
        expect(distributionHistory2[0].remainingTokensToClaim.eq(BN(0))).is.true;
      });
  
      it('Users can claim their pending rewards together', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        const skipTimeInSeconds = SLOT_BN.mul(BN(3600)).add(BN(3600));
  
        await skipTime(skipTimeInSeconds.toNumber());
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await skipTime(skipTimeInSeconds.toNumber());
        await distribute(distributionContract, token, distributeAmountBN);
  
        const balance = await token.balanceOf(user1.address);
        await distributionContract.connect(user1).claimRewards();
  
        const expectedAmount = await debitFee(token, distributeAmountBN.mul(BN(2)));
  
        const finalBalance = await token.balanceOf(user1.address);
        const epochTimeInHoursBN = BN(Math.floor(Date.now() / 1000 / 3600)).add(
          SLOT_BN.mul(BN(2)).add(BN(2))
        );
        const userStatus = await distributionContract.getUserStatus(user1.address);
  
        expect(finalBalance.sub(balance).eq(expectedAmount)).is.true;
        expect(userStatus.lastClaimedTimestamp.eq(epochTimeInHoursBN)).is.true;
  
        const distributionHistory = await distributionContract.getDistributionHistory();
        for (let i = 0; i < distributionHistory.length; i++) {
          expect(distributionHistory[i].remainingTokensToClaim.eq(BN(0))).is.true;
        }
      });
  
      it('Event emitted when fund claimed', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await expect(distributionContract.connect(user1).claimRewards())
          .to.emit(distributionContract, 'Claim')
          .withArgs(user1.address, distributeAmountBN);
      });
  
      it('Reverts when user tries to claim after a successful claim within same slot', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await distributionContract.connect(user1).claimRewards();
  
        await expect(distributionContract.connect(user1).claimRewards()).to.be.revertedWith(
          'LINGO: Already claimed'
        );
      });
  
      it('Reverts when user tries to claim with no rewards', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
  
        const skipTimeBN = SLOT_BN.mul(BN(3600));
        await skipTime(skipTimeBN.sub(BN(3600)).toNumber());
  
        await withdraw(distributionContract, user1, amountBN);
        await skipTime(BN(2).mul(BN(3600)).toNumber());
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await distributionContract.connect(user1).claimRewards();
  
        await skipTime(skipTimeBN.toNumber());
        await distribute(distributionContract, token, distributeAmountBN);
  
        await expect(distributionContract.connect(user1).claimRewards()).to.be.revertedWith(
          'LINGO: Zero rewards'
        );
      });
  
      it('Reverts when an user who have not staked tries to claim', async () => {
        await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await expect(distributionContract.connect(user1).claimRewards()).to.be.revertedWith(
          'LINGO: Not an active user'
        );
      });
  
      it('Reverts when staking is not active', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
        await skipTime(BN(SLOT_BN).mul(BN(3600)).add(BN(3600)).toNumber());
  
        await expect(distributionContract.connect(user1).claimRewards()).to.be.revertedWith(
          'LINGO: Distribution is on hold. Please contact admin'
        );
      });
  
      it('Rewards calculation should be consistant after multiple slots', async () => {
  
  
        // ----------------Slot 1-------------------------------------
  
        const amountBN1ForSlot1 = BN(100).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2ForSlot1 = BN(200).mul(BN(10).pow(DECIMALS_BN));
        const amountBN3ForSlot1 = BN(300).mul(BN(10).pow(DECIMALS_BN));
  
        const slotHalfTime = SLOT_BN.div(BN(2)).mul(BN(3600))
  
        const expectedCredits1Slot1 = creditsForDuration(amountBN1ForSlot1, slotHalfTime);
        const expectedCredits2Slot1 = creditsForDuration(amountBN2ForSlot1, slotHalfTime);
        const expectedCredits3Slot1 = creditsForDuration(amountBN3ForSlot1, slotHalfTime);
        
        let totalCreditsBNSlot1 = expectedCredits1Slot1.add(expectedCredits2Slot1).add(expectedCredits3Slot1);
  
        await deposit(distributionContract, token, user1, amountBN1ForSlot1);
        await deposit(distributionContract, token, user2, amountBN2ForSlot1);
        await deposit(distributionContract, token, user3, amountBN3ForSlot1);
  
        await skipTime(slotHalfTime.toNumber());
  
        await withdraw(distributionContract, user1, amountBN1ForSlot1);
        await withdraw(distributionContract, user2, amountBN2ForSlot1);
        await withdraw(distributionContract, user3, amountBN3ForSlot1);
  
        await skipTime(slotHalfTime.add(3600).toNumber());
  
        const distributeAmountBNForSlot1 = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBNForSlot1);
        
        // ----------------Slot 2-------------------------------------
        const amountBN1ForSlot2 = BN(300).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2ForSlot2 = BN(200).mul(BN(10).pow(DECIMALS_BN));
        const amountBN3ForSlot2 = BN(100).mul(BN(10).pow(DECIMALS_BN));
  
        const bufferTimeToGenerateCredits = BN(3600).mul(BN(48));
  
        const expectedCredits1Slot2 = creditsForDuration(amountBN1ForSlot2, slotHalfTime.add(bufferTimeToGenerateCredits));
        const expectedCredits2Slot2 = creditsForDuration(amountBN2ForSlot2, bufferTimeToGenerateCredits);
        const expectedCredits3Slot2 = creditsForDuration(amountBN3ForSlot2, bufferTimeToGenerateCredits);
        
        let totalCreditsBNSlot2 = expectedCredits1Slot2.add(expectedCredits2Slot2).add(expectedCredits3Slot2);
  
        // ------------------User1 Claim for Slot 1 and Deposit for Slot 2--------------------------------------------
        const user1ClaimSlot1 = userClaim(expectedCredits1Slot1, totalCreditsBNSlot1, distributeAmountBNForSlot1);
        const user2ClaimSlot1 = userClaim(expectedCredits2Slot1, totalCreditsBNSlot1, distributeAmountBNForSlot1);
        const user3ClaimSlot1 = userClaim(expectedCredits3Slot1, totalCreditsBNSlot1, distributeAmountBNForSlot1);
  
        await expect(distributionContract.connect(user1).claimRewards())
          .to.emit(distributionContract, 'Claim')
          .withArgs(user1.address, user1ClaimSlot1);
  
        await deposit(distributionContract, token, user1, amountBN1ForSlot2);
  
        await skipTime(slotHalfTime.toNumber());
        
        // ---------------------Remaining Claim for Slot 1--------------------------
        await expect(distributionContract.connect(user2).claimRewards())
        .to.emit(distributionContract, 'Claim')
        .withArgs(user2.address, user2ClaimSlot1);
  
        await expect(await distributionContract.connect(user3).claimRewards())
        .to.emit(distributionContract, 'Claim')
        .withArgs(user3.address, user3ClaimSlot1);
  
        // -------------------Remaining deposit for Slot 2 ---------------------------
        await deposit(distributionContract, token, user2, amountBN2ForSlot2);
        await deposit(distributionContract, token, user3, amountBN3ForSlot2);
  
        // -------------------Time to generate credits for Remianing users-------------
  
        skipTime(bufferTimeToGenerateCredits.toNumber());
  
        // -------------------Slot 2 Withdraw------------------------------------------
        await withdraw(distributionContract, user1, amountBN1ForSlot2);
        await withdraw(distributionContract, user2, amountBN2ForSlot2);
        await withdraw(distributionContract, user3, amountBN3ForSlot2);
  
        await skipTime(slotHalfTime.add(3600).toNumber());
         
        const distributeAmountBNForSlot2 = BN(20000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBNForSlot2);
   
        // -----------------Slot 2 Claim---------------------------------------------
        const user1ClaimSlot2 = userClaim(expectedCredits1Slot2, totalCreditsBNSlot2, distributeAmountBNForSlot2);
        const user2ClaimSlot2 = userClaim(expectedCredits2Slot2, totalCreditsBNSlot2, distributeAmountBNForSlot2);
        const user3ClaimSlot2 = userClaim(expectedCredits3Slot2, totalCreditsBNSlot2, distributeAmountBNForSlot2);
  
  
        await expect(distributionContract.connect(user1).claimRewards())
          .to.emit(distributionContract, 'Claim')
          .withArgs(user1.address, user1ClaimSlot2);
        
        await expect(distributionContract.connect(user2).claimRewards())
        .to.emit(distributionContract, 'Claim')
        .withArgs(user2.address, user2ClaimSlot2);
  
        await expect(await distributionContract.connect(user3).claimRewards())
        .to.emit(distributionContract, 'Claim')
        .withArgs(user3.address, user3ClaimSlot2);
  
  
      //     // ----------------Slot 3-------------------------------------
      //     const amountBN1ForSlot3 = BN(200).mul(BN(10).pow(DECIMALS_BN));
      //     const amountBN2ForSlot3 = BN(300).mul(BN(10).pow(DECIMALS_BN));
      //     const amountBN3ForSlot3 = BN(100).mul(BN(10).pow(DECIMALS_BN));
    
      //     await deposit(distributionContract, token, user1, amountBN1ForSlot3);
      //     await deposit(distributionContract, token, user2, amountBN2ForSlot3);
      //     await deposit(distributionContract, token, user3, amountBN3ForSlot3);
    
      //     await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
  
      //     const distributeAmountBNForSlot3 = BN(30000).mul(BN(10).pow(DECIMALS_BN));
      //     await distribute(distributionContract, token, distributeAmountBNForSlot3);
    
      //     await expect(distributionContract.connect(user1).claimRewards())
      //     .to.emit(distributionContract, 'Claim')
      //     .withArgs(user1.address, distributeAmountBN);
        
      //   await expect(distributionContract.connect(user2).claimRewards())
      //   .to.emit(distributionContract, 'Claim')
      //   .withArgs(user2.address, distributeAmountBN);
  
      //   await expect(await distributionContract.connect(user3).claimRewards())
      //   .to.emit(distributionContract, 'Claim')
      //   .withArgs(user3.address, distributeAmountBN);
      });
  
    });
  
    describe('Admin Claim', () => {
      beforeEach(async () => {
        const balanceBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        await initialFundAllocation(token, balanceBN);
      });
  
      it('Admin can withdraw the expired tokens after admin claim period', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
        await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        const balance = await token.balanceOf(owner.address);
  
        const adminClaimPeriod = await distributionContract.getAdminClaimPeriod();
        await skipTime(adminClaimPeriod.mul(BN(3600)).toNumber());
  
        await distributionContract.adminClaim();
  
        const finalBalance = await token.balanceOf(owner.address);
  
        expect(finalBalance.sub(balance).eq(distributeAmountBN)).is.true;
  
        const distributionHistory = await distributionContract.getDistributionHistory();
        expect(distributionHistory[distributionHistory.length - 1].remainingTokensToClaim.eq(BN(0)))
          .is.true;
      });
  
      it('Admin can withdraw the expired tokens of multiple slots together', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
        await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await skipTime(SLOT_BN.mul(BN(3600)).toNumber());
        await distribute(distributionContract, token, distributeAmountBN);
  
        await skipTime(SLOT_BN.mul(BN(3600)).toNumber());
        await distribute(distributionContract, token, distributeAmountBN);
  
        const balance = await token.balanceOf(owner.address);
        let distributionHistory = await distributionContract.getDistributionHistory();
        const expectedAmount = distributionHistory.reduce((acc, curr) => {
          return BN(acc).add(curr.remainingTokensToClaim);
        }, 0);
  
        const adminClaimPeriod = await distributionContract.getAdminClaimPeriod();
        await skipTime(adminClaimPeriod.mul(BN(3600)).toNumber());
  
        await distributionContract.adminClaim();
  
        const finalBalance = await token.balanceOf(owner.address);
        expect(finalBalance.sub(balance).eq(expectedAmount)).is.true;
  
        distributionHistory = await distributionContract.getDistributionHistory();
        distributionHistory.forEach((val) => {
          expect(val.remainingTokensToClaim.eq(BN(0))).is.true;
        });
      });
  
      it('Admin can withdraw only expired tokens', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
        await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await skipTime(SLOT_BN.mul(BN(3600)).toNumber());
        await distribute(distributionContract, token, distributeAmountBN);
  
        await skipTime(SLOT_BN.mul(BN(3600)).toNumber());
        await distribute(distributionContract, token, distributeAmountBN);
  
        const adminClaimPeriod = await distributionContract.getAdminClaimPeriod();
        await skipTime(adminClaimPeriod.sub(SLOT_BN).mul(BN(3600)).toNumber());
  
        await distributionContract.adminClaim();
  
        distributionHistory = await distributionContract.getDistributionHistory();
        expect(distributionHistory[distributionHistory.length - 1].remainingTokensToClaim.eq(BN(0)))
          .is.false;
      });
  
      it('Event emitted when admin claims expired tokens', async () => {
        const amountBN = BN(100).mul(BN(10).pow(DECIMALS_BN));
        await deposit(distributionContract, token, user1, amountBN);
        await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        const adminClaimPeriod = await distributionContract.getAdminClaimPeriod();
        await skipTime(adminClaimPeriod.mul(BN(3600)).toNumber());
  
        await expect(distributionContract.adminClaim())
          .to.emit(distributionContract, 'AdminClaim')
          .withArgs(owner.address, distributeAmountBN);
      });
  
      it('Reverts when now owner tries to claim expired rewards', async () => {
        await expect(distributionContract.connect(user1).adminClaim()).to.be.revertedWith(
          'Ownable: caller is not the owner'
        );
      });
    });
  
    describe('Random', () => {
      beforeEach(async () => {
        const balanceBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
        await initialFundAllocation(token, balanceBN);
      });
  
      it('Random 1', async () => {
        const amountBN1 = BN(101).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(67).mul(BN(10).pow(DECIMALS_BN));
        const amountBN3 = BN(33).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN1);
        await deposit(distributionContract, token, user2, amountBN2);
        await deposit(distributionContract, token, user3, amountBN3);
  
        await skipTime(SLOT_BN.mul(BN(3600)).add(BN(3600)).toNumber());
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await distributionContract.connect(user1).claimRewards();
        await distributionContract.connect(user2).claimRewards();
        await distributionContract.connect(user3).claimRewards();
      });
  
      it('Random 2', async () => {
        const amountBN1 = BN(101).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(67).mul(BN(10).pow(DECIMALS_BN));
        const amountBN3 = BN(33).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN1);
  
        await skipTime(
          BN(10 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user2, amountBN2);
  
        await skipTime(
          BN(10 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user3, amountBN3);
  
        await skipTime(
          BN(11 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await distributionContract.connect(user1).claimRewards();
        await distributionContract.connect(user2).claimRewards();
        await distributionContract.connect(user3).claimRewards();
      });
  
      it('Random 3', async () => {
        const amountBN1 = BN(101).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(67).mul(BN(10).pow(DECIMALS_BN));
        const amountBN3 = BN(33).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN1);
  
        await skipTime(
          BN(10 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user2, amountBN2);
        await withdraw(distributionContract, user1, BN(10).mul(BN(10).pow(DECIMALS_BN)));
  
        await skipTime(
          BN(10 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user3, amountBN3);
        await withdraw(distributionContract, user2, BN(17).mul(BN(10).pow(DECIMALS_BN)));
  
        await skipTime(
          BN(11 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await distributionContract.connect(user1).claimRewards();
        await distributionContract.connect(user2).claimRewards();
        await distributionContract.connect(user3).claimRewards();
      });
  
      it('Random 4', async () => {
        const amountBN1 = BN(101).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(67).mul(BN(10).pow(DECIMALS_BN));
        const amountBN3 = BN(33).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN1);
  
        await skipTime(
          BN(15 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user2, amountBN2);
        await withdraw(distributionContract, user1, BN(10).mul(BN(10).pow(DECIMALS_BN)));
        await deposit(distributionContract, token, user3, amountBN3);
  
        await skipTime(
          BN(5 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user1, amountBN3);
        await withdraw(distributionContract, user2, amountBN2);
  
        await skipTime(
          BN(11 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await distributionContract.connect(user1).claimRewards();
        await distributionContract.connect(user2).claimRewards();
        await distributionContract.connect(user3).claimRewards();
      });
  
      it('Random 5', async () => {
        const amountBN1 = BN(101).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(67).mul(BN(10).pow(DECIMALS_BN));
        const amountBN3 = BN(33).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN1);
  
        await skipTime(
          BN(15 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user2, amountBN2);
        await withdraw(distributionContract, user1, BN(10).mul(BN(10).pow(DECIMALS_BN)));
        await deposit(distributionContract, token, user3, amountBN3);
  
        await skipTime(
          BN(5 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user1, amountBN3);
        await withdraw(distributionContract, user2, amountBN2);
  
        await skipTime(
          BN(11 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await distributionContract.connect(user1).claimRewards();
        await distributionContract.connect(user2).claimRewards();
  
        await skipTime(
          BN(10 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await distributionContract.connect(user3).claimRewards();
      });
  
      it('Random 6', async () => {
        const amountBN1 = BN(101).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(67).mul(BN(10).pow(DECIMALS_BN));
        const amountBN3 = BN(33).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN1);
  
        await skipTime(
          BN(15 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user2, amountBN2);
        await withdraw(distributionContract, user1, BN(10).mul(BN(10).pow(DECIMALS_BN)));
        await deposit(distributionContract, token, user3, amountBN3);
  
        await skipTime(
          BN(5 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user1, amountBN3);
        await withdraw(distributionContract, user2, amountBN2);
  
        await skipTime(
          BN(11 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await distributionContract.connect(user1).claimRewards();
        await distributionContract.connect(user2).claimRewards();
  
        await skipTime(
          BN(10 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user1, amountBN3);
        await deposit(distributionContract, token, user2, amountBN3);
  
        await skipTime(
          BN(10 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await withdraw(distributionContract, user2, BN(20).mul(BN(10).pow(DECIMALS_BN)));
        await distributionContract.connect(user3).claimRewards();
      });
  
      it('Random 7', async () => {
        const amountBN1 = BN(101).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(67).mul(BN(10).pow(DECIMALS_BN));
        const amountBN3 = BN(33).mul(BN(10).pow(DECIMALS_BN));
  
        await deposit(distributionContract, token, user1, amountBN1);
  
        await skipTime(
          BN(15 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user2, amountBN2);
        await withdraw(distributionContract, user1, BN(10).mul(BN(10).pow(DECIMALS_BN)));
        await deposit(distributionContract, token, user3, amountBN3);
  
        await skipTime(
          BN(5 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await deposit(distributionContract, token, user1, amountBN3);
        await withdraw(distributionContract, user2, amountBN2);
  
        await skipTime(
          BN(11 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);
  
        await distributionContract.connect(user1).claimRewards();
  
        await skipTime(
          BN(10 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await distributionContract.connect(user2).claimRewards();
        await deposit(distributionContract, token, user1, amountBN3);
        await deposit(distributionContract, token, user2, amountBN3);
  
        await skipTime(
          BN(5 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await withdraw(distributionContract, user2, BN(20).mul(BN(10).pow(DECIMALS_BN)));
  
        await skipTime(
          BN(16 * 24)
            .mul(BN(3600))
            .toNumber()
        );
  
        await distribute(distributionContract, token, BN(1).mul(BN(10).pow(DECIMALS_BN)));
  
        await distributionContract.connect(user3).claimRewards();
      });

    // 1) Three users make a deposit at the start of the first distribution period.
    // 2) One user withdraws halfway through the distribution period, so they no longer have any locked amount but should have forecasted credits.
    // 3) A distribution event happens.
    // 4) Then all three users claim and withdraw everything.
      it('Random 8', async () => {
        const amountBN1 = BN(100).mul(BN(10).pow(DECIMALS_BN));
        const amountBN2 = BN(200).mul(BN(10).pow(DECIMALS_BN));
        const amountBN3 = BN(300).mul(BN(10).pow(DECIMALS_BN));

        // -------------------------------------------------------------------------
        // THREE USERS MAKE A DEPOSIT AT THE START OF THE FIRST DISTRIBUTION PERIOD.
        // -------------------------------------------------------------------------

        await deposit(distributionContract, token, user1, amountBN1);
        await deposit(distributionContract, token, user2, amountBN2);
        await deposit(distributionContract, token, user3, amountBN3);

        // Balance
        // user1 - 100
        // user2 - 200
        // user3 - 300

        // -------------------------------------------------------------------------
        // ONE USER WITHDRAWS HALFWAY THROUGH THE DISTRIBUTION PERIOD, 
        // SO THEY NO LONGER HAVE ANY LOCKED AMOUNT BUT SHOULD HAVE FORECASTED CREDITS.
        // -------------------------------------------------------------------------

        // 15 Days skip
        await skipTime(
          BN(15 * 24)
            .mul(BN(3600))
            .toNumber()
        );

        await withdraw(distributionContract, user1, amountBN1);

        // Balance
        // user1 - 0
        // user2 - 200
        // user3 - 300
        
        // -------------------------------------------------------------------------
        // A DISTRIBUTION EVENT HAPPENS.
        // -------------------------------------------------------------------------

        // 15 Days and 1 hour skip
        await skipTime(
          BN(15 * 24)
            .mul(BN(3600))
            .add(BN(3600))
            .toNumber()
        );

        const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
        await distribute(distributionContract, token, distributeAmountBN);

        // Calculate credits for each of the users for slot one
        const expectedCreditsForUser1 = creditsForDuration(amountBN1, BN(15 * 24).mul(BN(3600)));
        const expectedCreditsForUser2 = creditsForDuration(amountBN2, SLOT_BN.mul(BN(3600)));
        const expectedCreditsForUser3 = creditsForDuration(amountBN3, SLOT_BN.mul(BN(3600)));

        console.log("expected credits:\n");
        console.log({
          expectedCreditsForUser1,
          expectedCreditsForUser2,
          expectedCreditsForUser3
        });

        // fetch forcasted credits for each user from contract
        const user1Status = await distributionContract.getUserStatus(user1.address);
        const user2Status = await distributionContract.getUserStatus(user2.address);
        const user3Status = await distributionContract.getUserStatus(user3.address);
        
        const user1forcastedCredits = user1Status.forecastedCredits;
        const user2forcastedCredits = user2Status.forecastedCredits;
        const user3forcastedCredits = user3Status.forecastedCredits;

        console.log("forcasted credits:\n");
        console.log({
          user1forcastedCredits,
          user2forcastedCredits,
          user3forcastedCredits
        });

        expect(user1forcastedCredits.eq(expectedCreditsForUser1)).is.true;
        expect(user2forcastedCredits.eq(expectedCreditsForUser2)).is.true;
        expect(user3forcastedCredits.eq(expectedCreditsForUser3)).is.true;

        let totalCredits = expectedCreditsForUser1.add(expectedCreditsForUser2).add(expectedCreditsForUser3);

        // -------------------------------------------------------------------------
        // ALL THREE USERS CLAIM AND WITHDRAW EVERYTHING.
        // -------------------------------------------------------------------------

        // 1 hour skip 
        await skipTime(BN(3600).toNumber());
        
        // calculate claim externally
        const user1Claim = userClaim(expectedCreditsForUser1, totalCredits, distributeAmountBN);
        const user2Claim = userClaim(expectedCreditsForUser2, totalCredits, distributeAmountBN);
        const user3Claim= userClaim(expectedCreditsForUser3, totalCredits, distributeAmountBN);

        console.log({
          user1Claim,
          user2Claim,
          user3Claim
        });
          
        await expect(distributionContract.connect(user1).claimRewards())
          .to.emit(distributionContract, 'Claim')
          .withArgs(user1.address, user1Claim);
        
        await expect(distributionContract.connect(user2).claimRewards())
        .to.emit(distributionContract, 'Claim')
        .withArgs(user2.address, user2Claim);

        await expect(await distributionContract.connect(user3).claimRewards())
        .to.emit(distributionContract, 'Claim')
        .withArgs(user3.address, user3Claim);

        await withdraw(distributionContract, user2, amountBN2);
        await withdraw(distributionContract, user3, amountBN3);

        // Balance
        // user1 - 0
        // user2 - 0
        // user3 - 0

      });
    });
  });

  describe('Without whitelisting', () => {

    beforeEach(async () => {
      const balanceBN = BN(1000).mul(BN(10).pow(DECIMALS_BN));
      await initialFundAllocation(token, balanceBN);
    });

    it('Reduce fee if contract is not whitelisted while user deposit fund', async () => {
      const user1amountBN1 = BN(100).mul(BN(10).pow(DECIMALS_BN));

      const user1expectedAmountAfterFee1 = await debitFee(token, user1amountBN1);

      await token.connect(user1).approve(distributionContract.address, user1amountBN1);
      await expect(distributionContract.connect(user1).deposit(user1amountBN1))
          .to.emit(distributionContract, 'Deposit')
          .withArgs(user1.address, user1expectedAmountAfterFee1);

      // skipTime(BN(15 * 24).mul(BN(3600)).toNumber());

      // await expect(distributionContract.connect(user1).withdraw(user1expectedAmountAfterFee1))
      // .to.emit(distributionContract, 'Withdraw')
      // .withArgs(user1.address, user1expectedAmountAfterFee1);

      // const user1statsAfterWithdraw = await distributionContract.getUserStatus(user1.address);
      // expect(user1statsAfterWithdraw.balance.eq(BN(0))).is.true;

      // skipTime(SLOT_BN.mul(BN(3600)).toNumber());

      // const distributeAmountBN = BN(10000).mul(BN(10).pow(DECIMALS_BN));
      //   await distribute(distributionContract, token, distributeAmountBN);

      // await distributionContract.connect(user1).claimRewards()

      
    });

  });
});
 