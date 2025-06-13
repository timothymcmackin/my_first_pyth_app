// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import { Test, console2 } from "forge-std/Test.sol";
import { XTZPythContract } from "../src/XTZPythContract.sol";
import { MockPyth } from "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract ContractToTest is Test {
  MockPyth public pyth;
  bytes32 XTZ_PRICE_FEED_ID = bytes32(uint256(0x1));
  XTZPythContract public app;
  address public owner;

  uint256 XTZ_TO_WEI = 10 ** 18;

  function setUp() public {
    pyth = new MockPyth(60, 1);
    owner = makeAddr("alice");
    app = new XTZPythContract(address(pyth), XTZ_PRICE_FEED_ID, owner);
  }

  function createEthUpdate(
    int64 xtzPrice
  ) private view returns (bytes[] memory) {
    bytes[] memory updateData = new bytes[](1);
    updateData[0] = pyth.createPriceFeedUpdateData(
      XTZ_PRICE_FEED_ID,
      xtzPrice * 100000, // price
      10 * 100000, // confidence
      -5, // exponent
      xtzPrice * 100000, // emaPrice
      10 * 100000, // emaConfidence
      uint64(block.timestamp), // publishTime
      uint64(block.timestamp) // prevPublishTime
    );

    return updateData;
  }

  function setXtzPrice(int64 xtzPrice) private {
    bytes[] memory updateData = createEthUpdate(xtzPrice);
    uint value = pyth.getUpdateFee(updateData);
    vm.deal(address(this), value);
    pyth.updatePriceFeeds{ value: value }(updateData);
  }

  function testMint() public {
    setXtzPrice(100);

    vm.deal(address(this), XTZ_TO_WEI);
    app.mint{ value: XTZ_TO_WEI / 100 }();
  }

  function testMintRevert() public {
    setXtzPrice(99);

    vm.deal(address(this), XTZ_TO_WEI);
    vm.expectRevert();
    app.mint{ value: XTZ_TO_WEI / 100 }();
  }

  function testMintStalePrice() public {
    setXtzPrice(100);

    skip(120);

    vm.deal(address(this), XTZ_TO_WEI);
    // Add this line
    vm.expectRevert();
    app.mint{ value: XTZ_TO_WEI / 100 }();
  }

  function testUpdateAndMint() public {
    bytes[] memory updateData = createEthUpdate(100);

    vm.deal(address(this), XTZ_TO_WEI);
    app.updateAndMint{ value: XTZ_TO_WEI / 100 }(updateData);
  }

  function testCashout() public {
    emit log("Owner address:");
    emit log_address(owner);
    emit log("Owner balance before:");
    emit log_uint(owner.balance);

    bytes[] memory updateData = createEthUpdate(100);

    vm.deal(address(this), XTZ_TO_WEI);
    app.updateAndMint{ value: XTZ_TO_WEI / 100 }(updateData);
    app.cashout();
    emit log("Owner balance after:");
    emit log_uint(owner.balance);
  }

  function testBadCashout() public {
    vm.expectRevert();
    app.cashout();
  }
}
