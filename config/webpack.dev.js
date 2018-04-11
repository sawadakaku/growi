/**
 * @author: Yuki Takei <yuki@weseek.co.jp>
 */

const path = require('path');
const webpack = require('webpack');
const helpers = require('./helpers');

/*
 * Webpack Plugins
 */
const ExtractTextPlugin = require('extract-text-webpack-plugin');


/*
 * Webpack configuration
 *
 * See: http://webpack.github.io/docs/configuration.html#cli
 */
module.exports = require('./webpack.common')({
  mode: 'development',
  devtool: 'cheap-module-source-map',
  entry: {
    dev: './resource/js/dev',
  },
  output: {
    filename: '[name].bundle.js',
    chunkFilename: '[name].chunk.js',
  },
  resolve: {
    extensions: ['.js', '.json'],
    modules: [helpers.root('src'), helpers.root('node_modules'), path.join(process.env.HOME, '.node_modules')],
  },
  module: {
    rules: [
    ],
  },
  plugins: [

    new ExtractTextPlugin('[name].bundle.css'),

    new webpack.DllReferencePlugin({
      context: helpers.root('public/dll'),
      manifest: path.join(helpers.root('public/dll'), 'manifest.json')
    }),

    new webpack.HotModuleReplacementPlugin(),

  ],
  performance: {
    hints: false
  }
});
