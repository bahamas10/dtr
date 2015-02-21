#!/usr/sbin/dtrace -s
/**
 * taken from http://www.brendangregg.com/DTrace/dtrace_oneliners.txt
 */

#pragma D option quiet

BEGIN {
	printf("tracing, ctrl-c to exit...\n");
}
syscall::exec*:return
{
	printf("[%Y] %s\n", walltimestamp, curpsinfo->pr_psargs);
}
