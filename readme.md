# keka-checkin

Simple pupeteer script to automate the process of checkin in/out of keka

**Note: This could be a binary but I'm too packed to do that right now, might do that later.**

## Usage

```sh
# clone this repo
git clone git@github.com:barelyhuman/keka-checkin

# install the deps
yarn

# setup .env file
cp .env.template .env

# fill in the env file and then
./cli.js --in
# or
./cli.js --out
```

To make it easier, set an alias into your bash/zsh for the same

```sh
alias kekacheck="path/to/this/repo/cli.js"
```

and then use it as so

```sh
kekacheck --in
# or
kekacheck --out
```

## Caveats

- Doesn't support google's device based confirmation flow yet.

## License

[MIT](/license)