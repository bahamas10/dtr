#!/usr/sbin/dtrace -s
/**
 * taken from http://www.brendangregg.com/DTrace/dtrace_oneliners.txt
 */

BEGIN {
	printf("tracing, ctrl-c to exit...\n");
}
syscall:::entry
{
	@[pid, execname] = count();
}
