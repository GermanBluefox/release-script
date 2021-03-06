"use strict";
/*

    Bumps the package version and releases a new tag
    to set off a CI and npm release run

    CALL THIS WITH:
    npx AlCalzone/release-script#v1.0.0 -- [<releaseType> [<postfix]] [--dry]
    or
    npx AlCalzone/release-script#v1.0.0 -- <version> [--dry]

    PLACEHOLDER for next version in CHANGELOG.md:
    ## __WORK IN PROGRESS__

    PLACEHOLDER for next version in README.md:
    ### __WORK IN PROGRESS__

*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-var-requires */
const strings_1 = require("alcalzone-shared/strings");
const typeguards_1 = require("alcalzone-shared/typeguards");
const child_process_1 = require("child_process");
const safe_1 = __importDefault(require("colors/safe"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const semver = __importStar(require("semver"));
const yargs_1 = require("yargs");
const tools_1 = require("./tools");
const translate_1 = require("./translate");
const rootDir = process.cwd();
// lerna mode offloads bumping the versions to lerna.
// it implies --all, since that is what lerna does
const lernaCheck = yargs_1.argv.lernaCheck || yargs_1.argv["lerna-check"] || yargs_1.argv._.includes("--lerna-check");
const lerna = lernaCheck || yargs_1.argv.lerna || yargs_1.argv._.includes("--lerna");
// in lerna mode, these have no effect
const isDryRun = yargs_1.argv.dry || yargs_1.argv._.includes("--dry");
const allChanges = yargs_1.argv.all || yargs_1.argv._.includes("--all");
function fail(reason) {
    console.error("");
    console.error(safe_1.default.red("ERROR: " + reason));
    console.error("");
    process.exit(1);
}
// ensure that package.json exists and has a version (in lerna mode)
const packPath = path.join(rootDir, "package.json");
if (!fs.existsSync(packPath)) {
    fail("No package.json found in the current directory!");
}
const pack = require(packPath);
if (!lerna && !(pack === null || pack === void 0 ? void 0 : pack.version)) {
    fail("Missing property version from package.json!");
}
const lernaPath = path.join(rootDir, "lerna.json");
if (lerna && !fs.existsSync(lernaPath)) {
    fail("No lerna.json found in the current directory!");
}
let lernaJson;
if (lerna) {
    lernaJson = require(lernaPath);
    if (!lernaJson.version) {
        fail("Missing property version from lerna.json!");
    }
}
// If this is an ioBroker project, also bump the io-package.json
const ioPackPath = path.join(rootDir, "io-package.json");
const hasIoPack = fs.existsSync(ioPackPath);
const ioPack = hasIoPack ? require(ioPackPath) : undefined;
if (!lerna && hasIoPack && !((_a = ioPack === null || ioPack === void 0 ? void 0 : ioPack.common) === null || _a === void 0 ? void 0 : _a.version)) {
    fail("Missing property common.version from io-package.json!");
}
// Try to find the changelog
let isChangelogInReadme = false;
let CHANGELOG_PLACEHOLDER_PREFIX = "##";
const changelogPath = path.join(rootDir, "CHANGELOG.md");
const readmePath = path.join(rootDir, "README.md");
/** Can also be the readme! */
let changelog;
let changelogFilename;
if (!fs.existsSync(changelogPath)) {
    // The changelog might be in the readme
    if (!fs.existsSync(readmePath)) {
        fail("No CHANGELOG.md or README.md found in the current directory!");
    }
    isChangelogInReadme = true;
    changelog = fs.readFileSync(readmePath, "utf8");
    changelogFilename = path.basename(readmePath);
    // The changelog is indented one more level in the readme
    CHANGELOG_PLACEHOLDER_PREFIX += "#";
}
else {
    changelog = fs.readFileSync(changelogPath, "utf8");
    changelogFilename = path.basename(changelogPath);
}
// CHANGELOG_OLD is only used if the main changelog is in the readme
const changelogOldPath = path.join(rootDir, "CHANGELOG_OLD.md");
const hasChangelogOld = isChangelogInReadme && fs.existsSync(changelogOldPath);
const CHANGELOG_PLACEHOLDER = CHANGELOG_PLACEHOLDER_PREFIX + " __WORK IN PROGRESS__";
const CHANGELOG_PLACEHOLDER_REGEX = new RegExp("^" + CHANGELOG_PLACEHOLDER + "$", "gm");
// check if the changelog contains exactly 1 occurence of the changelog placeholder
switch ((changelog.match(CHANGELOG_PLACEHOLDER_REGEX) || []).length) {
    case 0:
        fail(safe_1.default.red(`Cannot continue, the changelog placeholder is missing from ${changelogFilename}!\n` +
            "Please add the following line to your changelog:\n" +
            CHANGELOG_PLACEHOLDER));
    case 1:
        break; // all good
    default:
        fail(safe_1.default.red(`Cannot continue, there is more than one changelog placeholder in ${changelogFilename}!`));
}
// Check if there is a changelog for the current version
const currentChangelog = tools_1.extractCurrentChangelog(changelog, CHANGELOG_PLACEHOLDER_PREFIX, CHANGELOG_PLACEHOLDER_REGEX);
if (!currentChangelog) {
    fail(safe_1.default.red("Cannot continue, the changelog for the next version is empty!"));
}
// check if there are untracked changes
const gitStatus = child_process_1.execSync("git status", { cwd: rootDir, encoding: "utf8" });
if (/have diverged/.test(gitStatus)) {
    if (!isDryRun) {
        fail(safe_1.default.red("Cannot continue, the local branch has diverged from the git repo!"));
    }
    else {
        console.log(safe_1.default.red("This is a dry run. The full run would fail due to a diverged branch\n"));
    }
}
else if (!lerna && !/working tree clean/.test(gitStatus)) {
    if (!isDryRun && !allChanges) {
        fail(safe_1.default.red(`Cannot continue, the local branch has uncommitted changes! Add them to a separate commit first or add the "--all" option to include them in the release commit.`));
    }
    else {
        if (allChanges) {
            console.warn(safe_1.default.yellow(`Your branch has uncommitted changes that will be included in the release commit!
Consider adding them to a separate commit first.
`));
        }
        else {
            console.log(safe_1.default.red(`This is a dry run. The full run would fail due to uncommitted changes.
Add them to a separate commit first or add the "--all" option to include them in the release commit.
`));
        }
    }
}
else if (/Your branch is behind/.test(gitStatus)) {
    if (!isDryRun) {
        fail(safe_1.default.red("Cannot continue, the local branch is behind the remote changes!"));
    }
    else {
        console.log(safe_1.default.red("This is a dry run. The full run would fail due to the local branch being behind\n"));
    }
}
else if (/Your branch is up\-to\-date/.test(gitStatus) ||
    /Your branch is ahead/.test(gitStatus)) {
    // all good
    if (!lerna) {
        console.log(safe_1.default.green("git status is good - I can continue..."));
    }
}
// All the necessary checks are done, exit
if (lernaCheck)
    process.exit(0);
const releaseTypes = [
    "major",
    "premajor",
    "minor",
    "preminor",
    "patch",
    "prepatch",
    "prerelease",
];
const releaseType = yargs_1.argv._[0] || "patch";
if (!lerna && releaseType.startsWith("--")) {
    fail(`Invalid release type ${releaseType}. If you meant to pass hyphenated args, try again without the single "--".`);
}
let newVersion;
if (lerna) {
    newVersion = lernaJson.version;
}
else {
    // Find the highest current version
    let oldVersion = pack.version;
    if (hasIoPack &&
        semver.valid(ioPack.common.version) &&
        semver.gt(ioPack.common.version, oldVersion)) {
        oldVersion = ioPack.common.version;
    }
    if (releaseTypes.indexOf(releaseType) > -1) {
        if (releaseType.startsWith("pre") && yargs_1.argv._.length >= 2) {
            // increment to pre-release with an additional prerelease string
            newVersion = semver.inc(oldVersion, releaseType, yargs_1.argv._[1]);
        }
        else {
            newVersion = semver.inc(oldVersion, releaseType);
        }
        console.log(`bumping version ${safe_1.default.blue(oldVersion)} to ${safe_1.default.gray(releaseType)} version ${safe_1.default.green(newVersion)}\n`);
    }
    else {
        // increment to specific version
        newVersion = semver.clean(releaseType);
        if (newVersion == null) {
            fail(`invalid version string "${newVersion}"`);
        }
        else {
            // valid version string => check if its actually newer
            if (!semver.gt(newVersion, pack.version)) {
                fail(`new version ${newVersion} is NOT > than package.json version ${pack.version}`);
            }
            if (hasIoPack && !semver.gt(newVersion, ioPack.common.version)) {
                fail(`new version ${newVersion} is NOT > than io-package.json version ${ioPack.common.version}`);
            }
        }
        console.log(`bumping version ${oldVersion} to specific version ${newVersion}`);
    }
}
(() => __awaiter(void 0, void 0, void 0, function* () {
    if (isDryRun) {
        console.log(safe_1.default.yellow("dry run:") + " not updating package files");
    }
    else {
        if (!lerna) {
            console.log(`updating package.json from ${safe_1.default.blue(pack.version)} to ${safe_1.default.green(newVersion)}`);
            pack.version = newVersion;
            fs.writeFileSync(packPath, JSON.stringify(pack, null, 2));
        }
        const d = new Date();
        changelog = changelog.replace(CHANGELOG_PLACEHOLDER_REGEX, `${CHANGELOG_PLACEHOLDER_PREFIX} ${newVersion} (${d.getFullYear()}-${strings_1.padStart("" + (d.getMonth() + 1), 2, "0")}-${strings_1.padStart("" + d.getDate(), 2, "0")})`);
        // If there's a CHANGELOG_OLD.md, we need to split the changelog
        if (hasChangelogOld) {
            const { newChangelog, oldChangelog } = tools_1.splitChangelog(changelog, CHANGELOG_PLACEHOLDER_PREFIX, 5);
            console.log(`updating ${changelogFilename}`);
            fs.writeFileSync(isChangelogInReadme ? readmePath : changelogPath, newChangelog, "utf8");
            if (oldChangelog) {
                console.log(`moving old changelog entries to CHANGELOG_OLD.md`);
                let oldChangelogFileContent = fs.readFileSync(changelogOldPath, "utf8");
                oldChangelogFileContent = tools_1.insertIntoChangelog(oldChangelogFileContent, oldChangelog, CHANGELOG_PLACEHOLDER_PREFIX.slice(1));
                fs.writeFileSync(changelogOldPath, oldChangelogFileContent, "utf8");
            }
        }
        else {
            console.log(`updating ${changelogFilename}`);
            fs.writeFileSync(isChangelogInReadme ? readmePath : changelogPath, changelog, "utf8");
        }
        // Prepare the changelog so it can be put into io-package.json news and the commit message
        const newChangelog = tools_1.cleanChangelogForNews(currentChangelog);
        // Prepare the commit message
        fs.writeFileSync(path.join(rootDir, ".commitmessage"), `chore: release v${newVersion}

${newChangelog}`);
        if (hasIoPack) {
            console.log(`updating io-package.json from ${safe_1.default.blue(ioPack.common.version)} to ${safe_1.default.green(newVersion)}`);
            ioPack.common.version = newVersion;
            if (newVersion in ioPack.common.news) {
                console.log(`current news is already in io-package.json`);
            }
            else if (typeguards_1.isObject(ioPack.common.news.NEXT)) {
                console.log(`replacing version number for current news io-package.json...`);
                ioPack.common.news = tools_1.prependKey(ioPack.common.news, newVersion, ioPack.common.news.NEXT);
                delete ioPack.common.news.NEXT;
            }
            else {
                console.log(`adding new news to io-package.json...`);
                try {
                    const translated = yield translate_1.translateText(newChangelog);
                    ioPack.common.news = tools_1.prependKey(ioPack.common.news, newVersion, translated);
                }
                catch (e) {
                    fail(`could not translate the news: ${e}`);
                }
                // If someone left this in here, also delete it
                delete ioPack.common.news.NEXT;
            }
            // Make sure we don't have too many keys
            if (Object.keys(ioPack.common.news).length > 20) {
                ioPack.common.news = tools_1.limitKeys(ioPack.common.news, 20);
            }
            fs.writeFileSync(ioPackPath, JSON.stringify(ioPack, null, 4));
        }
        // if build script exists, call it
        if (pack.scripts && pack.scripts.build) {
            console.log(`Build project "${safe_1.default.blue('npm run build')}" ...`);
            child_process_1.execSync('npm run build', { cwd: rootDir });
        }
    }
    const gitCommands = lerna
        ? [
            `git add -A -- ":(exclude).commitmessage"`,
            `git commit -F ".commitmessage"`,
        ]
        : [
            `npm install`,
            `git add -A -- ":(exclude).commitmessage"`,
            `git commit -F ".commitmessage"`,
            `git tag v${newVersion}`,
            `git push`,
            `git push --tags`,
        ];
    if (isDryRun) {
        console.log(safe_1.default.yellow("dry run:") + " I would execute this:");
        for (const command of gitCommands) {
            console.log("  " + command);
        }
    }
    else {
        for (const command of gitCommands) {
            console.log(`executing "${safe_1.default.blue(command)}" ...`);
            child_process_1.execSync(command, { cwd: rootDir });
        }
        // Delete the commit message file again
        try {
            fs.unlinkSync(path.join(rootDir, ".commitmessage"));
        }
        catch (e) {
            /* ignore */
        }
    }
    console.log("");
    console.log(safe_1.default.green("done!"));
    console.log("");
    process.exit(0);
}))().catch((e) => {
    console.error(e);
    process.exit(1);
});
