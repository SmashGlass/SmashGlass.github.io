/**
 * Post-processes a preview build so it can never interfere with the live site:
 *  - deletes CNAME (would try to claim smashglass.com for the preview repo)
 *  - replaces robots.txt with a blanket Disallow, so the preview can't be
 *    indexed and compete with the real site for the same copy.
 */
import { rmSync, writeFileSync, existsSync } from 'node:fs';

if (existsSync('dist/CNAME')) {
  rmSync('dist/CNAME');
  console.log('removed dist/CNAME');
} else {
  console.log('no dist/CNAME present');
}

writeFileSync('dist/robots.txt', 'User-agent: *\nDisallow: /\n');
console.log('robots.txt set to Disallow (preview must not be indexed)');
