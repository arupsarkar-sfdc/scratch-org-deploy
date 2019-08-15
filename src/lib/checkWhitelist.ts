import * as logger from 'heroku-logger';

// checking for whitelisting
const checkWhitelist = (ghuser: string, ghrepo: string) => {
    const whitelist1 = process.env.GITHUB_USERNAME_WHITELIST; // comma separated list of username
    const whitelist2 = process.env.GITHUB_REPO_WHITELIST; // comma separated list of username/repo

    if (!whitelist1 && !whitelist2) {
        return false;
    }

    if (whitelist1) {
        whitelist1.split(',').forEach(username => {
            if (username.trim() === ghuser) {
                return true;
            }
        });
    }

    if (whitelist2) {
        whitelist2.split(',').forEach(repo => {
            logger.debug(`checking whitelist 2 element: ${repo}`);
            if (repo.trim().split('/')[0] === ghuser && repo.trim().split('/')[1] === ghrepo) {
                return true;
            }
        });
    }

    return false;
};

export { checkWhitelist };
