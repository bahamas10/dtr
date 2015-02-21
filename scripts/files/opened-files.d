#!/usr/sbin/dtrace -s
/**
 * taken from http://www.brendangregg.com/DTrace/dtrace_oneliners.txt
 */

#pragma D option quiet

BEGIN {
	printf("tracing, ctrl-c to exit...\n");
}

syscall::open*:entry
{
	printf("[pid %d] %s %s\n", pid, execname, copyinstr(arg0));
}
