# keka-checkin

pupeteer based cli to simplify the process of checking in/out of keka

**Note: This could be a binary but I'm too packed to do that right now, might do that later.**

## Usage

```sh
# clone this repo
git clone git@github.com:barelyhuman/keka-checkin

# install the deps
yarn

# setup .env file
cp .env.template .env

# log into your keka account 
./cli.js --login

# once the above is completed you can use the below 
./cli.js --in
# or
./cli.js --out
```

```sh
alias kekacheck="path/to/this/repo/cli.js"
```

and then use it as so

```sh
kekacheck --in
# or
kekacheck --out
```

## License

[MIT](/license)
