module.exports = {
  apps: [
    {
      name: 'api',
      script: './src/index.js',
      node_args: '-r esm',
      watch: true,
      ignore_watch: ['node_modules', 'docker-data'],
    },
  ],
};
