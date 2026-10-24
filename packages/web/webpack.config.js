import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default (_env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    entry: './src/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProd ? '[name].[contenthash:8].js' : '[name].js',
      clean: true,
      publicPath: '/',
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.jsx', '.js'],
      // The shared workspace is ESM with explicit .js specifiers; webpack needs
      // to resolve those to the emitted files rather than guessing.
      extensionAlias: { '.js': ['.ts', '.tsx', '.js', '.jsx'] },
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: 'babel-loader',
        },
        {
          // maplibre-gl ships CSS that must be bundled for controls to render.
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    plugins: [
      // Webpack 5 does not polyfill `process`; inject only what the client needs.
      new webpack.DefinePlugin({
        'process.env.GRAPHQL_ENDPOINT': JSON.stringify(
          process.env.GRAPHQL_ENDPOINT ?? '/graphql',
        ),
      }),
      new HtmlWebpackPlugin({
        template: './public/index.html',
        title: 'NYC Cultural Infrastructure & Neighborhood Safety Atlas',
      }),
      new ForkTsCheckerWebpackPlugin({
        typescript: { configFile: path.resolve(__dirname, 'tsconfig.json') },
      }),
    ],
    devServer: {
      port: 3000,
      hot: true,
      historyApiFallback: true,
      client: { overlay: { errors: true, warnings: false } },
      proxy: [{ context: ['/graphql'], target: 'http://localhost:4000' }],
    },
    devtool: isProd ? 'source-map' : 'eval-cheap-module-source-map',
    performance: {
      // deck.gl and maplibre are large by nature; budget enforced in CI instead.
      hints: isProd ? 'warning' : false,
      maxAssetSize: 3_000_000,
      maxEntrypointSize: 3_000_000,
    },
  };
};
