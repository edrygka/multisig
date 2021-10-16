const chai = require('chai');
const expect = chai.expect;
const { ethers } = require('hardhat');
require('@nomiclabs/hardhat-web3');

describe('MultiSig', () => {
  let MultiSigContract;
  let multiSig;
  let accounts;
  let owners;

  before(async () => {
    accounts = await ethers.getSigners();
    owners = accounts.slice(0, 3).map(acc => acc.address);
    MultiSigContract = await ethers.getContractFactory('MultiSigWallet');
    multiSig = await MultiSigContract.deploy(owners, 2);
    await multiSig.deployed();
  });

  describe('getRequiredConfirmations', () => {
    it('should return required confirmation', async () => {
      expect(await multiSig.getRequiredConfirmations()).to.eq(2);
    });
  });

  describe('getOwners', () => {
    it('should return right addresses', async () => {
      expect(await multiSig.getOwners()).to.eql(owners);
    });
  });

  describe('payable', () => {
    it('should receive ethers on contract address and emit Deposit event', async () => {
      const from = accounts[3].address;
      const signer = await ethers.getSigner(from);
      const value = ethers.utils.parseEther('1'); // 1 ether
      await expect(signer.sendTransaction({
        to: multiSig.address,
        value
      }))
        .to.emit(multiSig, 'Deposit')
        .withArgs(from, value, value);
    });
  });

  describe('submitTransaction', () => {
    it('should create transaction structure', async () => {
      const to = accounts[4].address;
      const value = ethers.utils.parseEther('2'); // 2 ethers
      const data = web3.utils.fromAscii('hello bitches');

      await expect(multiSig.submitTransaction(to, value, data))
        .to.emit(multiSig, 'SubmitTransaction')
        .withArgs(owners[0], 0, to, value, data);
    });

    it('should revert call to function if its not an owner', async () => {
      const to = accounts[4].address;
      const value = ethers.utils.parseEther('2'); // 2 ethers
      const data = web3.utils.fromAscii('bitches, wrong transaction!');

      await expect(multiSig.connect(accounts[3]).submitTransaction(to, value, data))
        .to.be.revertedWith('not owner');
    });
  });

  // TODO: add tests for confirmTransaction, executeTransaction, revokeConfirmation, getTransaction
});
