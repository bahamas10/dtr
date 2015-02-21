#!/usr/sbin/dtrace -s
/**
 * taken from http://www.brendangregg.com/DTrace/dtrace_oneliners.txt
 */

BEGIN {
	printf("tracing for 10 seconds...\n");
}

syscall:::entry
{
	@[pid, execname] = count();
}

tick-10sec
{
	exit(0);
}
