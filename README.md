# cdkoutputs2sh

[![npm version](https://img.shields.io/npm/v/cdkoutputs2sh.svg)](https://www.npmjs.com/package/cdkoutputs2sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)

cdkoutputs2sh
は
AWS CDK の `cdk deploy --outputs-file var/outputs.json` で生成されるスタック出力 JSON を、`source` 可能なシェル環境変数エクスポートスクリプト (`var/outputs.sh`) に変換する CLI / ライブラリです。

## 特長

- CDK 出力(JSON) → `export VAR=...` 形式へ自動変換
- 変数名と元の `StackName.OutputKey` の対応をコメントで保持
- 値は安全なシングルクォートでシェルクォート
- 非スカラー(配列/オブジェクト)は警告してスキップ
- 変数名衝突を検知するとエラー終了

## インストール

```bash
npm install -D cdkoutputs2sh
```

## 使い方

1. CDK でデプロイし JSON を生成
   ```sh
   cdk deploy --outputs-file var/outputs.json
   ```
2. 変換
   ```sh
   cdkoutputs2sh --input var/outputs.json --output var/outputs.sh
   ```
3. 読み込み
   ```sh
   source var/outputs.sh
   echo "$AWSCDKP0STACK_INSTANCEID"
   ```

## オプション

| オプション        | エイリアス | 説明                      | デフォルト       |
| ----------------- | ---------- | ------------------------- | ---------------- |
| --input <path>    | -i         | 入力 JSON                 | var/outputs.json |
| --output <path>   | -o         | 出力シェルスクリプト      | var/outputs.sh   |
| --fail-on-missing | なし       | 入力が無い場合に失敗扱い  | false            |
| --verbose         | -v / -vv   | ログ詳細度 (INFO / DEBUG) | なし             |
| --help            | -h         | ヘルプ表示                | -                |

## 変数名生成ルール

1. StackName_OutputKey を結合し大文字化
1. 英数字以外は _ に置換し連続 _ を 1 つに
1. 先頭/末尾の \_ を除去
1. 先頭が数字なら V\_ を付加
1. スタック名が Cdk で始まる場合、先頭に CDK\_ を付加 (サンプル互換)
1. 衝突した場合はエラー

### 例:

- AwsCdkP0Stack.InstanceId → AWSCDKP0STACK_INSTANCEID
- CdkLambdaUrls1Stack.Lambda1FunctionUrl → CDK_CDKLAMBDAURLS1STACK_LAMBDA1FUNCTIONURL

## 制限と注意

- 配列/オブジェクト値はスキップされます
- 衝突時は CDK の Output 名を変更してください
- 出力ファイルのパーミッションは 0644

## Node.js API

```javascript
import { convertCdkOutputs } from "cdkoutputs2sh";

const { exportBlock, mapping } = convertCdkOutputs({
  input: "var/outputs.json",
  output: "var/outputs.sh",
  verbose: 1,
});

console.log(exportBlock);
console.log(mapping["AWSCDKP0STACK_INSTANCEID"]);
```

## 開発

レポジトリからクローン後

```sh
pnpm run init  # `pnpm init` ではない. run-scripts参照
pnpm run smoketest # help が 表示される
pnpm test # Vitest によるケース検証
```

## ライセンス

MIT License
